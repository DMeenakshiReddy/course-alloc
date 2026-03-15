# LuxEstate - Premium Real Estate Website

A comprehensive real estate website built with HTML, CSS, JavaScript frontend and Node.js/Express backend.

## Features

### Frontend Features
- **Beautiful Home Page**: Modern, responsive design with hero section and property listings
- **Property Listings**: Grid layout with property cards showing images, details, and pricing
- **Property Details**: Modal popups with image galleries, videos, and comprehensive information
- **Login System**: User authentication with modal-based login form
- **Document Upload**: File upload system for buyer documents (ID proof, income statements, etc.)
- **Advance Payment**: Secure payment form with card processing simulation
- **Contact Section**: Contact form with validation and information display
- **Responsive Design**: Mobile-friendly layout that works on all devices
- **Smooth Animations**: Scroll effects and hover animations for better UX

### Backend Features
- **RESTful API**: Complete REST API with proper HTTP methods and status codes
- **User Authentication**: JWT-based authentication with secure password hashing
- **File Upload**: Multer-based file upload with validation and storage
- **Payment Processing**: Secure payment processing with validation
- **Contact Form**: Contact form handling with email notifications
- **Data Validation**: Input validation using express-validator
- **Rate Limiting**: API rate limiting to prevent abuse
- **Security**: Helmet middleware for security headers
- **Error Handling**: Comprehensive error handling throughout the application

## Technology Stack

### Frontend
- **HTML5**: Semantic markup structure
- **CSS3**: Modern styling with Flexbox and Grid
- **JavaScript (ES6+)**: Modern JavaScript features
- **Font Awesome**: Icon library
- **Responsive Design**: Mobile-first approach

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **JWT**: JSON Web Tokens for authentication
- **bcryptjs**: Password hashing
- **Multer**: File upload handling
- **Nodemailer**: Email sending functionality
- **express-validator**: Input validation
- **Helmet**: Security middleware
- **express-rate-limit**: Rate limiting

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Setup Instructions

1. **Clone or download the project**
   ```bash
   cd luxestate-real-estate
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```
   Or for production:
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

## Project Structure

```
luxestate-real-estate/
├── css/
│   └── style.css              # Main stylesheet
├── js/
│   └── script.js              # Frontend JavaScript
├── uploads/
│   └── documents/             # Uploaded documents (auto-created)
├── index.html                 # Main HTML file
├── server.js                  # Backend server
├── package.json               # Node.js dependencies
└── README.md                  # Project documentation
```

## API Endpoints

### Authentication
- `POST /api/register` - Register new user
- `POST /api/login` - User login

### Properties
- `GET /api/properties` - Get all properties (with filtering)
- `GET /api/properties/:id` - Get specific property

### User Actions
- `POST /api/upload-documents` - Upload documents (authenticated)
- `POST /api/payments` - Process advance payment (authenticated)

### Contact
- `POST /api/contact` - Submit contact form
- `POST /api/newsletter` - Subscribe to newsletter

## Features Details

### Property Management
- View property listings with images and details
- Filter properties by type, location, and price range
- Detailed property view with image gallery and video
- Property information including bedrooms, bathrooms, and square footage

### User Authentication
- Secure user registration and login
- JWT token-based authentication
- Password hashing with bcrypt
- Protected routes for sensitive operations

### Document Upload
- Upload multiple documents (PDF, images, DOC files)
- File type and size validation
- Secure file storage with unique filenames
- Support for ID proof, income statements, and other documents

### Payment System
- Advance payment processing
- Card information validation
- Transaction tracking
- Email confirmations

### Contact System
- Contact form with validation
- Email notifications to admin
- Newsletter subscription
- Social media integration

## Security Features

- Password hashing with bcrypt
- JWT token authentication
- Input validation and sanitization
- File upload validation
- Rate limiting on API endpoints
- Security headers with Helmet
- CORS configuration

## Responsive Design

The website is fully responsive and works on:
- Desktop computers
- Tablets
- Mobile phones
- Various screen sizes

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Development

### Running in Development Mode
```bash
npm run dev
```
This will start the server with nodemon for auto-restart on file changes.

### Environment Variables
Create a `.env` file for production:
```
PORT=3000
JWT_SECRET=your-secret-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-email-password
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and queries:
- Email: info@luxestate.com
- Phone: +1 (555) 123-4567
- Website: www.luxestate.com

---

**Note**: This is a demonstration project. In production, you would need to:
- Set up a proper database (MongoDB, PostgreSQL, etc.)
- Configure real email service credentials
- Implement actual payment gateway integration
- Add more comprehensive error handling
- Set up proper logging and monitoring
- Deploy to a production server
