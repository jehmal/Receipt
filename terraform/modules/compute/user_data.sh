#!/bin/bash
# Receipt Vault Pro - EC2 Instance User Data Script
# Bootstraps application instances with required software and configuration

set -e

# Log all output
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "Starting Receipt Vault Pro instance bootstrap..."

# Update system
yum update -y

# Install required packages
yum install -y \
    docker \
    awscli \
    jq \
    htop \
    git \
    curl \
    wget \
    unzip

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# Install Node.js 18 (for the application)
curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
yum install -y nodejs

# Start and enable Docker
systemctl start docker
systemctl enable docker
usermod -a -G docker ec2-user

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Create application directory
mkdir -p /opt/receipt-vault
cd /opt/receipt-vault

# Create application user
useradd -r -s /bin/false receipt-vault
usermod -a -G docker receipt-vault

# Environment variables from template
export APP_PORT=${app_port}
export ENVIRONMENT=${environment}
export SECRETS_ARN=${secrets_arn}
export LOG_GROUP_NAME=${log_group_name}
export AWS_REGION=${aws_region}

# Install AWS CLI v2 (newer version)
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install

# Function to get secrets from AWS Secrets Manager
get_secret() {
    local secret_arn=$1
    aws secretsmanager get-secret-value --secret-id "$secret_arn" --region "$AWS_REGION" --query SecretString --output text
}

# Retrieve application secrets
echo "Retrieving application secrets..."
SECRET_JSON=$(get_secret "$SECRETS_ARN")

# Parse secrets and export as environment variables
export DATABASE_URL=$(echo "$SECRET_JSON" | jq -r '.database_url')
export REDIS_URL=$(echo "$SECRET_JSON" | jq -r '.redis_url')
export JWT_SECRET=$(echo "$SECRET_JSON" | jq -r '.jwt_secret')
export WORKOS_API_KEY=$(echo "$SECRET_JSON" | jq -r '.workos_api_key')
export WORKOS_CLIENT_ID=$(echo "$SECRET_JSON" | jq -r '.workos_client_id')
export WORKOS_COOKIE_PASSWORD=$(echo "$SECRET_JSON" | jq -r '.workos_cookie_password')

# Create environment file for the application
cat > /opt/receipt-vault/.env << EOF
# Application Configuration
NODE_ENV=$ENVIRONMENT
PORT=$APP_PORT
APP_URL=https://api.receiptvault.pro

# Database Configuration
DATABASE_URL=$DATABASE_URL
REDIS_URL=$REDIS_URL

# Authentication
JWT_SECRET=$JWT_SECRET
WORKOS_API_KEY=$WORKOS_API_KEY
WORKOS_CLIENT_ID=$WORKOS_CLIENT_ID
WORKOS_COOKIE_PASSWORD=$WORKOS_COOKIE_PASSWORD

# AWS Configuration
AWS_REGION=$AWS_REGION

# Logging
LOG_LEVEL=info
LOG_GROUP_NAME=$LOG_GROUP_NAME
EOF

# Set proper permissions for environment file
chown receipt-vault:receipt-vault /opt/receipt-vault/.env
chmod 600 /opt/receipt-vault/.env

# Clone application code (replace with your actual repository)
echo "Downloading application code..."
# For production, this would pull from your container registry or S3
# git clone https://github.com/your-org/receipt-vault-backend.git /opt/receipt-vault/app
# For now, we'll create a placeholder structure
mkdir -p /opt/receipt-vault/app

# Create a simple health check endpoint for testing
cat > /opt/receipt-vault/app/health-server.js << 'EOF'
const http = require('http');
const port = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime()
    }));
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

server.listen(port, () => {
  console.log(`Health server running on port $${port}`);
});
EOF

# Create systemd service for the application
cat > /etc/systemd/system/receipt-vault.service << EOF
[Unit]
Description=Receipt Vault Pro Application
After=network.target

[Service]
Type=simple
User=receipt-vault
Group=receipt-vault
WorkingDirectory=/opt/receipt-vault/app
Environment=NODE_ENV=$ENVIRONMENT
EnvironmentFile=/opt/receipt-vault/.env
ExecStart=/usr/bin/node health-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=receipt-vault

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/receipt-vault

[Install]
WantedBy=multi-user.target
EOF

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << EOF
{
    "logs": {
        "logs_collected": {
            "files": {
                "collect_list": [
                    {
                        "file_path": "/var/log/user-data.log",
                        "log_group_name": "$LOG_GROUP_NAME",
                        "log_stream_name": "{instance_id}/user-data.log"
                    },
                    {
                        "file_path": "/var/log/messages",
                        "log_group_name": "$LOG_GROUP_NAME",
                        "log_stream_name": "{instance_id}/messages"
                    }
                ]
            }
        }
    },
    "metrics": {
        "namespace": "ReceiptVault/EC2",
        "metrics_collected": {
            "cpu": {
                "measurement": ["cpu_usage_idle", "cpu_usage_iowait", "cpu_usage_user", "cpu_usage_system"],
                "metrics_collection_interval": 60,
                "totalcpu": true
            },
            "disk": {
                "measurement": ["used_percent"],
                "metrics_collection_interval": 60,
                "resources": ["*"]
            },
            "diskio": {
                "measurement": ["io_time"],
                "metrics_collection_interval": 60,
                "resources": ["*"]
            },
            "mem": {
                "measurement": ["mem_used_percent"],
                "metrics_collection_interval": 60
            },
            "netstat": {
                "measurement": ["tcp_established", "tcp_time_wait"],
                "metrics_collection_interval": 60
            }
        }
    }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
    -s

# Set proper ownership
chown -R receipt-vault:receipt-vault /opt/receipt-vault

# Enable and start the application service
systemctl daemon-reload
systemctl enable receipt-vault
systemctl start receipt-vault

# Configure log rotation
cat > /etc/logrotate.d/receipt-vault << EOF
/var/log/receipt-vault/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0644 receipt-vault receipt-vault
    postrotate
        systemctl reload receipt-vault
    endscript
}
EOF

# Create health check script
cat > /opt/receipt-vault/health-check.sh << 'EOF'
#!/bin/bash
# Health check script for Load Balancer

response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$APP_PORT/health)

if [ "$response" = "200" ]; then
    exit 0
else
    exit 1
fi
EOF

chmod +x /opt/receipt-vault/health-check.sh

# Configure automatic security updates
yum install -y yum-cron
systemctl enable yum-cron
systemctl start yum-cron

# Configure fail2ban for SSH protection
yum install -y epel-release
yum install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

# Set up monitoring script
cat > /opt/receipt-vault/monitor.sh << 'EOF'
#!/bin/bash
# Basic monitoring script

# Check application health
if ! curl -f -s http://localhost:$APP_PORT/health > /dev/null; then
    echo "$(date): Application health check failed" >> /var/log/receipt-vault-monitor.log
    systemctl restart receipt-vault
fi

# Check disk space
disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$disk_usage" -gt 85 ]; then
    echo "$(date): Disk usage is ${disk_usage}%" >> /var/log/receipt-vault-monitor.log
fi

# Check memory usage
mem_usage=$(free | grep Mem | awk '{printf("%.0f", $3/$2 * 100.0)}')
if [ "$mem_usage" -gt 85 ]; then
    echo "$(date): Memory usage is ${mem_usage}%" >> /var/log/receipt-vault-monitor.log
fi
EOF

chmod +x /opt/receipt-vault/monitor.sh

# Add monitoring to crontab
echo "*/5 * * * * /opt/receipt-vault/monitor.sh" | crontab -u receipt-vault -

# Signal that the instance is ready
/opt/aws/bin/cfn-signal -e $? --stack $STACK_NAME --resource AutoScalingGroup --region $AWS_REGION || true

echo "Receipt Vault Pro instance bootstrap completed successfully!"

# Wait for application to start
sleep 30

# Final health check
if curl -f -s http://localhost:$APP_PORT/health; then
    echo "Application is healthy and ready to serve traffic"
else
    echo "Warning: Application health check failed"
    systemctl status receipt-vault
fi