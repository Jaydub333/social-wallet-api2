# Multi-stage build for production optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S socialwallet -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=socialwallet:nodejs /app/dist ./dist
COPY --from=builder --chown=socialwallet:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=socialwallet:nodejs /app/prisma ./prisma

# Create logs directory
RUN mkdir logs && chown socialwallet:nodejs logs

# Switch to non-root user
USER socialwallet

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => { process.exit(1) })"

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]