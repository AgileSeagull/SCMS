# 📚 LibraryFlow

A comprehensive smart crowd management system that provides real-time occupancy tracking, QR code-based entry/exit logging, predictive analytics, and administrative controls for modern facilities.

![LibraryFlow](https://img.shields.io/badge/LibraryFlow-v1.0.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![Database](https://img.shields.io/badge/Database-SQLite-orange)
![Status](https://img.shields.io/badge/Status-Production%20Ready-brightgreen)

## 📑 Table of Contents

- [Features](#-features)
- [Architecture](#️-architecture)
- [Quick Start](#-quick-start)
- [Configuration](#-configuration)
- [Database Scripts](#-database-scripts)
- [Service Management Scripts](#-service-management-scripts)
- [Usage Guide](#-usage-guide)
- [Development](#️-development)
- [API Documentation](#-api-documentation)
- [Predictive Analytics](#-predictive-analytics)
- [Security Features](#-security-features)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

## 🌟 Features

### 👥 **Student Portal**
- **QR Code Generation**: Each student gets a unique QR code for entry/exit
- **Real-time Occupancy**: Live updates of library capacity and status
- **Entry/Exit Tracking**: Scan QR codes to log entry and exit
- **Session Management**: Fixed 1-hour time slots with auto-exit
- **Live Progress Timer**: Visual countdown and progress bar for active sessions
- **Status Notifications**: Real-time alerts for library status changes

### 🛠️ **Admin Dashboard**
- **Occupancy Management**: Monitor and control library capacity
- **Library Status Control**: Set library to Open/Closed/Maintenance with auto-scheduling
- **Entry/Exit Logs**: Comprehensive logging with filtering capabilities
- **Live Analytics & Insights**: Real-time charts for daily activity and peak hours
- **Predictive Analytics**: Holt-Winters forecasting for occupancy prediction (10-60 minutes ahead)
- **Removal Scores Management**: Automatic user removal when capacity is full based on 10 weighted parameters
- **Top Contenders View**: See top 5 users at risk of removal with manual removal controls
- **Capacity Alerts**: Notifications when library is full or near capacity

### 🔧 **Technical Features**
- **Real-time Updates**: Socket.io for instant notifications
- **Role-based Access**: Admin and Student user roles
- **QR Code System**: Secure entry/exit tracking
- **Predictive Forecasting**: Advanced time-series analysis with exogenous variables
- **Automatic User Removal**: Smart capacity management based on multiple factors
- **Responsive Design**: Mobile-friendly interface
- **TypeScript**: Full type safety across the stack

## 🏗️ **Architecture**

```
LibraryFlow/
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── controllers/    # API route handlers
│   │   ├── middleware/      # Authentication & authorization
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic (forecasting, removal scores, etc.)
│   │   ├── scripts/         # Database management scripts
│   │   ├── utils/           # Utility functions
│   │   └── types/            # TypeScript type definitions
│   └── prisma/              # Database schema & migrations
├── frontend/                # React + TypeScript SPA
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/            # Application pages
│   │   ├── services/        # API service layer
│   │   ├── hooks/            # Custom React hooks
│   │   └── contexts/        # React context providers
├── start.sh                 # Start services script
├── stop.sh                  # Stop services script
└── README.md
```

## 🚀 **Quick Start**

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Git**

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/libraryflow.git
cd libraryflow
```

### 2. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp env.example .env
# Edit .env with your configuration (see Configuration section)

# Set up database
npx prisma generate
npx prisma migrate dev
npx prisma db seed

# Start the backend server (or use start.sh from root)
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start the frontend development server (or use start.sh from root)
npm start
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Database Studio**: http://localhost:5555 (run `npm run db:studio` in backend directory)

## 🔧 **Configuration**

### Environment Variables
Create a `.env` file in the `backend` directory (use `env.example` as template):

```env
# Database
DATABASE_URL="file:./prisma/dev.db"

# JWT Secret (generate a strong random string)
JWT_SECRET="your-super-secret-jwt-key-here-change-in-production"

# Server Configuration
PORT=5000
NODE_ENV=development

# CORS (for production, specify your frontend domain)
CORS_ORIGIN="http://localhost:3000"
```

### Database Setup
The application uses SQLite by default. To use PostgreSQL:

1. Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/libraryflow"
```

2. Update provider in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Run migrations:
```bash
npx prisma migrate deploy
```

## 📊 **Database Scripts**

LibraryFlow includes several utility scripts for managing test data and database state. All scripts are run from the `backend` directory.

### 1. Populate Database (`db:populate`)

Populates the database with realistic student users and 500+ entry/exit logs spanning over a month.

```bash
cd backend
npm run db:populate
```

**Features**:
- Creates 20 real student users with realistic names and university emails
- Generates 500 entry/exit logs distributed over the last 30 days
- Realistic activity patterns (70% weekdays, peak hours, etc.)
- Proper ENTRY/EXIT alternation for each user
- Automatically calculates and updates system occupancy
- Sets expiration times for entry logs (1-hour sessions)

**Use Case**: Generate test data for analytics, testing features, or demos.

---

### 2. Reset Database (`db:reset`)

Cleans up the database by removing all populated data and resetting to a clean state.

```bash
cd backend
npm run db:reset
```

**What it does**:
- Deletes all populated student users (created by populate script)
- Deletes all entry/exit logs
- Clears library status history
- Resets current occupancy to 0
- Preserves max capacity setting
- Creates a default OPEN library status
- **Preserves admin and any pre-existing users**

**Warning**: This script will delete all populated student users, activity logs, and history. Only admin and pre-existing users are preserved.

---

### 3. Add Active Users (`db:add-active`)

Simulates QR code scans by randomly selecting student users and creating ENTRY logs for them, making them appear as active users inside the library.

```bash
cd backend
npm run db:add-active
```

**Features**:
- Randomly selects student users not currently inside
- Respects capacity limits (won't exceed maxCapacity)
- Creates ENTRY logs with 1-hour expiration times
- Updates user statistics (frequencyUsed)
- Updates system occupancy
- Perfect for testing removal scores, capacity features, or demos

**Output**: Shows list of users added and updated occupancy status.

---

### 4. Remove Active Users (`db:remove-active`)

Reverts changes made by `addActiveUsers` by creating EXIT logs for all currently active users.

```bash
cd backend
npm run db:remove-active
```

**What it does**:
- Finds all users currently inside (have ENTRY without subsequent EXIT)
- Creates EXIT logs for all active users
- Updates user's `lastActive` field
- Updates system occupancy (decrements for each exit)

**Use Case**: Clean up after testing or demos with active users.

---

### Common Workflows

#### Full Testing Setup
```bash
# Populate with historical data and users
npm run db:populate

# Add some active users for current testing
npm run db:add-active

# Test your features (removal scores, analytics, etc.)
# ... 

# Cleanup
npm run db:remove-active  # Remove active users
npm run db:reset          # Full reset (optional)
```

#### Quick Demo Setup
```bash
# Add active users for immediate demo
npm run db:add-active

# Demo features...

# Remove when done
npm run db:remove-active
```

#### Complete Reset
```bash
# Full database reset (removes all data, users, migrations)
cd backend
npx prisma migrate reset
npm run db:seed
```

## 🚦 **Service Management Scripts**

LibraryFlow includes convenient scripts for managing backend and frontend services.

### Start Services (`start.sh`)

Starts both backend and frontend services with health checks.

```bash
./start.sh
```

**Features**:
- Checks if services are already running
- Interactive prompts if services are running (option to restart)
- Auto-installs dependencies if missing
- Waits for services to be ready
- Shows service status and PIDs
- Displays access URLs

**Output**: Service status with PIDs and URLs.

---

### Stop Services (`stop.sh`)

Stops both backend (port 5000) and frontend (port 3000) services.

```bash
./stop.sh
```

**Features**:
- Graceful shutdown (tries kill first)
- Force kill if needed
- Shows which processes were stopped

---

### All Scripts Summary

| Script | Command | Description |
|--------|--------|-------------|
| **Start Services** | `./start.sh` | Start backend and frontend |
| **Stop Services** | `./stop.sh` | Stop backend and frontend |
| **Populate DB** | `npm run db:populate` (in backend/) | Add test data and users |
| **Reset DB** | `npm run db:reset` (in backend/) | Clean up populated data |
| **Add Active Users** | `npm run db:add-active` (in backend/) | Simulate active users |
| **Remove Active Users** | `npm run db:remove-active` (in backend/) | Remove all active users |
| **Seed DB** | `npm run db:seed` (in backend/) | Initial database seeding |
| **Run Migrations** | `npm run db:migrate` (in backend/) | Run database migrations |

## 📱 **Usage Guide**

### For Students
1. **Register/Login**: Create an account or login
2. **Get QR Code**: Your unique QR code is generated automatically
3. **Scan at Library**: Use the QR code scanner at library entrance
4. **Track Occupancy**: View real-time library capacity and status
5. **Monitor Session**: See remaining time and progress bar for your active session
6. **Auto-Exit**: Your session automatically ends after 1 hour

### For Administrators
1. **Login**: Use admin credentials
2. **Manage Occupancy**: Set max capacity and monitor current occupancy
3. **Control Status**: Set library to Open/Closed/Maintenance with auto-scheduling
4. **View Analytics**: Access real-time usage statistics and charts
5. **Predictive Forecasts**: See 10-60 minute occupancy predictions
6. **Removal Scores**: Monitor and manage automatic user removal when capacity is full
7. **Review Logs**: Filter and analyze entry/exit logs

## 🛠️ **Development**

### Available Scripts

#### Backend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio (http://localhost:5555)
npm run db:seed      # Seed database with sample data
npm run db:populate  # Populate with test data (500+ logs)
npm run db:reset     # Reset populated data
npm run db:add-active      # Add random active users
npm run db:remove-active   # Remove all active users
```

#### Frontend
```bash
npm start            # Start development server
npm run build        # Build for production
npm test             # Run tests
npm run eject        # Eject from Create React App (irreversible)
```

### Database Management
```bash
# Generate Prisma client
npx prisma generate

# Create and apply migrations
npx prisma migrate dev

# Reset database (removes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI for database)
npx prisma studio
```

## 📊 **API Documentation**

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Occupancy Endpoints
- `GET /api/occupancy` - Get current occupancy
- `POST /api/qr/scan` - Scan QR code for entry/exit
- `GET /api/qr/session` - Get current user session info

### Admin Endpoints
- `GET /api/admin/occupancy/stats` - Get occupancy statistics
- `PUT /api/admin/occupancy/max-capacity` - Update max capacity
- `GET /api/admin/occupancy/analytics` - Get analytics data
- `GET /api/logs` - Get entry/exit logs (filterable)
- `GET /api/analytics` - Get analytics data
- `GET /api/forecast` - Get occupancy forecast (10-60 min ahead)
- `POST /api/forecast/initialize` - Initialize forecast model
- `GET /api/removal-scores` - Get removal scores for active users
- `POST /api/removal-scores/auto-remove` - Trigger automatic removal
- `POST /api/removal-scores/remove-top` - Remove top N users by score

### Library Status Endpoints
- `GET /api/library-status` - Get library status
- `PUT /api/library-status` - Update library status

### QR Code Endpoints
- `GET /api/qr/generate` - Generate QR code for user
- `POST /api/qr/scan` - Scan QR code (entry/exit)

## 🧠 **Predictive Analytics**

LibraryFlow includes a sophisticated **Holt-Winters Exponential Smoothing Model** for predicting future occupancy.

### Features
- **Forecast Horizon**: 10-60 minutes ahead
- **Real-time Updates**: Model updates automatically with new observations
- **Exogenous Variables**: Incorporates net rate (entry - exit) dynamics
- **Outlier Handling**: Robust 3σ clipping to handle sensor errors
- **Confidence Metrics**: Each forecast includes confidence scores
- **Crowd Status**: Automatic classification (NORMAL/ALMOST_FULL/FULL)

### Model Components
- **Level**: Baseline occupancy trend
- **Trend**: Growth/shrinkage pattern
- **Seasonality**: Repeating patterns (hourly cycles)
- **Exogenous Regressor**: netRate (entry rate - exit rate)

### Access
Navigate to **Admin Dashboard → Analytics** tab to view:
- Historical occupancy trend (blue dashed line)
- Forecasted occupancy (green solid line)
- Model state information (level, trend, β weight)
- Crowd status predictions

## 🔒 **Security Features**

- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Admin and Student role separation
- **Input Validation**: Zod schema validation
- **CORS Protection**: Cross-origin request security
- **Password Hashing**: bcrypt password encryption
- **Protected Routes**: Frontend route protection with authentication checks

## 🧪 **Testing**

### Manual Testing
1. **User Registration**: Test student and admin registration
2. **QR Code Scanning**: Test entry/exit functionality
3. **Occupancy Management**: Test capacity controls
4. **Real-time Updates**: Test Socket.io notifications
5. **Admin Features**: Test analytics, logs, forecasts, and removal scores
6. **Session Management**: Test 1-hour auto-exit feature

### Test Data
Use the database scripts to generate test data:
```bash
# Generate comprehensive test data
npm run db:populate

# Add active users for testing
npm run db:add-active
```

## 🚀 **Deployment**

### Production Build
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
# Serve the build folder with a web server (nginx, Apache, etc.)
```

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database (PostgreSQL recommended)
3. Set secure JWT secret (strong random string)
4. Configure CORS for production domain
5. Use environment variables for all secrets

### Docker Deployment (Optional)
```dockerfile
# Example Dockerfile structure
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Write meaningful commit messages
- Update documentation for new features
- Test thoroughly before submitting PRs

## 📄 **License**

This project is licensed under the ISC License.

## 🙏 **Acknowledgments**

- React team for the amazing framework
- Prisma team for the excellent ORM
- Socket.io for real-time communication
- Recharts for data visualization
- Tailwind CSS for the utility-first CSS framework

---

**Made with ❤️ for smart crowd management**

For questions or support, please open an issue on GitHub.
