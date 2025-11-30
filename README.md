# Milky Dairy Backend

A Node.js/Express backend API for the Milky Dairy management system - handling authentication, milk tracking, and transaction management between sellers and buyers.

## Features

- **JWT Authentication** - Secure login with token-based auth and logout via token blacklisting
- **User Management** - Register as buyer or seller
- **Seller-Buyer Mapping** - Associate sellers with buyers
- **Milk Tracking** - Record daily milk entries (quantity, fat, shift)
- **Transaction Management** - Calculate and record payments

## Tech Stack

- Node.js + Express.js 5.1.0
- PostgreSQL (Supabase)
- JWT for authentication

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm
- Supabase account (free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/vividh-labana/milky-dairy.git

# Navigate to project directory
cd milky-dairy

# Install dependencies
npm install
```

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit `.env` and replace `YOUR-PASSWORD` with your Supabase database password:
   ```env
   DATABASE_URL="postgresql://postgres.exfqvkkassxypjycdpsw:YOUR_ACTUAL_PASSWORD@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true"
   JWT_SECRET=vividh_secret
   PORT=3001
   ```

### Run the Server

```bash
node server.js
```

Server will start at `http://localhost:3001`

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login and get JWT token |
| POST | `/logout` | Logout and blacklist token |
| GET | `/getUserInfo` | Get user details |

### Seller-Buyer Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/addSellerBuyerMapping` | Create/update seller-buyer relationship |
| GET | `/getSellersByBuyer` | Get sellers for a buyer |
| GET | `/getBuyerBySeller` | Get buyer for a seller |
| GET | `/getBuyers` | List all buyers |

### Milk Info
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/addMilkInfo` | Add milk entry |
| GET | `/getMilkInfoBySeller` | Get milk records for seller |
| DELETE | `/deleteMilkInfo` | Delete milk entry |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/calculateAmount` | Calculate payment amount |
| POST | `/addTransaction` | Record a transaction |
| GET | `/getTransactionDetails` | Get transactions for seller |

## Database Schema

Tables are auto-created on server start:
- `role` - User accounts
- `seller_buyer_mapping` - Relationships
- `milk_info` - Daily milk entries
- `transaction` - Payment records
- `blacklistToken` - Expired JWT tokens

## Related

- [Milky Dairy Frontend](https://github.com/vividh-labana/milky-dairy-frontend) - React frontend

## License

This project is not licensed.
