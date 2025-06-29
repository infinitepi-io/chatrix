FROM public.ecr.aws/docker/library/node:20-slim

# Set working directory
WORKDIR /var/task

# Copy AWS Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 /lambda-adapter /opt/extensions/lambda-adapter

# Copy package files
COPY package*.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile --production

# Copy application code
COPY . .

# Set environment variables for Lambda Web Adapter
ENV AWS_LWA_ENABLE_COMPRESSION=true
ENV AWS_LWA_PORT=3000
ENV AWS_LWA_READINESS_CHECK_PATH=/health
ENV AWS_LWA_READINESS_CHECK_PROTOCOL=http

# Expose port for local testing
EXPOSE 3000

# The Lambda Web Adapter will handle the Lambda runtime
# Your app just needs to start on port 3000
CMD ["node", "index.js"]