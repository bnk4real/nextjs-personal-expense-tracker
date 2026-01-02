# 💰 Expense Tracker

A comprehensive personal finance management application built with Next.js, featuring subscription tracking, expense management, income tracking with tax calculations, and detailed state tax information.

## ✨ Features

### 🔐 Authentication
- User registration and login
- JWT-based secure authentication
- Protected routes and user sessions

### 📊 Expense Management
- Track expenses by category
- Multiple account support (Cash, Bank, Credit Card)
- Date-based expense logging
- Category management

### 💼 Subscription Tracking
- Monitor recurring subscriptions
- Track billing cycles and payment dates
- Provider information and notes
- Cost analysis and alerts

### 💵 Income Tracking
- Record various income sources
- Tax calculation integration
- State and filing status support
- Account balance updates

### 🧾 Tax Calculations
- **Federal Tax**: Progressive brackets for all filing statuses
- **State Tax**: Support for 12+ states including CA, NY, IL, MA, CT, TX, FL
- **Real IRS Data**: Uses official 2024 tax brackets and standard deductions
- **Filing Status Support**: Single, Married Filing Jointly/Separately, Head of Household
- **Local Calculation**: No external API dependencies for reliability

### 📈 State Tax Information
- Comprehensive state tax comparison
- Income tax brackets by state
- Sales tax rates
- Property tax averages
- Interactive tax calculators

### 🎨 Modern UI
- Built with shadcn/ui components
- Responsive design
- Dark/light theme support
- Intuitive navigation

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd expense-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/expense_tracker"
   JWT_SECRET="your-super-secret-jwt-key-here"
   NEXTAUTH_SECRET="your-nextauth-secret"
   NEXTAUTH_URL="http://localhost:4000"
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npx prisma generate

   # Run database migrations
   npx prisma migrate dev

   # (Optional) Seed the database
   npx prisma db seed
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**

   Navigate to [http://localhost:4000](http://localhost:4000)

## 📁 Project Structure

```
expense-tracker/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── accounts/      # Account management
│   │   ├── auth/          # Authentication
│   │   ├── categories/    # Category management
│   │   ├── expenses/      # Expense CRUD
│   │   ├── incomes/       # Income tracking
│   │   ├── subscriptions/ # Subscription management
│   │   ├── tax/           # Tax calculations
│   │   └── user/          # User profile
│   ├── accounts/          # Account pages
│   ├── categories/        # Category pages
│   ├── expenses/          # Expense pages
│   ├── incomes/           # Income pages
│   ├── login/             # Authentication
│   ├── register/          # User registration
│   ├── settings/          # User settings
│   ├── subscriptions/     # Subscription pages
│   └── tax-info/          # State tax information
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── app/              # App-specific components
├── lib/                  # Utility functions
├── prisma/               # Database schema and migrations
└── public/               # Static assets
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: JWT tokens
- **Icons**: Lucide React
- **Date Handling**: date-fns
- **Notifications**: Sonner

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/user` - Get current user info

### Expenses
- `GET /api/expenses` - Get all expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/[id]` - Update expense
- `DELETE /api/expenses/[id]` - Delete expense

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category

### Accounts
- `GET /api/accounts` - Get all accounts
- `POST /api/accounts` - Create account

### Subscriptions
- `GET /api/subscriptions` - Get user subscriptions
- `POST /api/subscriptions` - Create subscription
- `PUT /api/subscriptions/[id]` - Update subscription
- `DELETE /api/subscriptions/[id]` - Delete subscription

### Income
- `GET /api/incomes` - Get all incomes
- `POST /api/incomes` - Create income entry

### Tax Calculations
- `POST /api/tax/calculate` - Calculate federal and state taxes

## 🧾 Tax Calculation Features

### Supported States
- California (CA)
- New York (NY)
- Illinois (IL)
- Massachusetts (MA)
- Connecticut (CT)
- Texas (TX) - No income tax
- Florida (FL) - No income tax
- Nevada (NV) - No income tax
- Washington (WA) - No income tax
- Wyoming (WY) - No income tax
- South Dakota (SD) - No income tax
- Alaska (AK) - No income tax

### Filing Status Support
- Single
- Married Filing Jointly
- Married Filing Separately
- Head of Household

### Tax Data Source
- **Federal**: Official 2024 IRS tax brackets and standard deductions
- **State**: Current state tax rates and brackets
- **Reliability**: Local calculation ensures privacy and availability

## 🔧 Development

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Database Management
```bash
npx prisma studio          # Open Prisma Studio
npx prisma migrate dev     # Create and apply migrations
npx prisma generate        # Generate Prisma client
npx prisma db push         # Push schema changes
```

### Code Quality
- **TypeScript**: Strict type checking enabled
- **ESLint**: Code linting and formatting
- **Prettier**: Code formatting (via ESLint)

## 🚀 Deployment

### Environment Variables for Production
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
JWT_SECRET="your-production-jwt-secret"
NEXTAUTH_SECRET="your-production-nextauth-secret"
NEXTAUTH_URL="https://yourdomain.com"
```

### Build and Deploy
```bash
npm run build
npm run start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Tax data based on official IRS publications

## 📞 Support

For questions or issues, please open an issue on GitHub or contact the development team.

---

**Happy budgeting!** 🎉

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
