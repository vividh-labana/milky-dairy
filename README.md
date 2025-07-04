# Milky Dairy Backend

## Description
This is the backend service for the Milky Dairy application. It provides APIs for managing sellers, buyers, milk transactions, and authentication using JWT.

## Features
- Seller and Buyer management
- Milk transaction tracking
- Authentication and authorization using JWT
- Token blacklisting for secure logout

## Technologies Used
- Node.js
- Express.js
- PostgreSQL

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/vividh-labana/milky-dairy.git
   ```
2. Navigate to the project directory:
   ```bash
   cd milky-dairy-backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure the database connection in `server.js`.
5. Start the server:
   ```bash
   node server.js
   ```

## API Endpoints
### Authentication
- `POST /register`: Register a new user
- `POST /login`: Login and receive a JWT token
- `POST /logout`: Logout and blacklist the token

### Seller-Buyer Management
- `POST /addSellerBuyerMapping`: Add or update seller-buyer mapping
- `GET /getSellersByBuyer`: Get sellers associated with a buyer
- `GET /getBuyerBySeller`: Get buyers associated with a seller

### Milk Info
- `POST /addMilkInfo`: Add milk information
- `GET /getMilkInfoBySeller`: Get milk information for a seller
- `DELETE /deleteMilkInfo`: Delete milk information

### Transactions
- `POST /addTransaction`: Add a transaction
- `GET /getTransactionDetails`: Get transaction details for a seller

## License
This project is licensed under the MIT License.