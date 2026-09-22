# Impact Five

Impact Five is a subscription-based golf score tracking and monthly prize-draw platform. Members can record their latest Stableford scores, select a charity to support, manage their membership, participate in monthly draws, and track prize results.

Administrators can manage members, scores, subscriptions, charities, draws, winners, verification documents, and payouts.

## Features

### Subscriber features

- Secure signup, login, and logout
- Charity selection during signup
- Profile and password management
- Latest-five Stableford score management
- Score validation between 1 and 45
- Prevention of duplicate and future-dated scores
- Monthly or yearly membership
- Razorpay subscription checkout
- Optional demo-payment mode
- Subscription cancellation at period end
- Charity selection with a minimum 10% contribution
- Charity search and category filtering
- Charity profiles, impact information, and upcoming events
- Monthly draw eligibility tracking
- Draw history and prize results
- Winner proof upload and payout tracking
- Responsive desktop and mobile interface

### Administrator features

- View and edit members
- Change member names and roles
- Manage member scores
- Manage demo subscriptions
- Create, edit, activate, deactivate, feature, and delete charities
- Simulate and publish monthly draws
- Review winner verification documents
- Manage winner verification and payout status
- View charity contribution information

## Technology stack

- Next.js 16
- React
- TypeScript
- Tailwind CSS
- Supabase Authentication
- Supabase PostgreSQL
- Supabase Row Level Security
- Supabase Storage
- Razorpay subscriptions
- Vercel

## Local setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd impact-five
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=

ENABLE_DEMO_PAYMENTS=true
```

Do not commit `.env.local` or expose secret/service-role keys in client-side code.

### 4. Configure Supabase

The application requires the following Supabase tables:

- `profiles`
- `scores`
- `charities`
- `subscription_plans`
- `subscriptions`
- `draws`
- `draw_entries`
- `draw_winners`

Supabase Authentication must be enabled for email and password authentication.

The application also uses:

- Row Level Security policies
- Secure PostgreSQL functions/RPCs
- A signup trigger that creates a subscriber profile
- A trigger that rejects future-dated scores
- A private storage bucket for winner proof documents
- Service-role access for protected server-side administration routes

### 5. Configure subscription plans

Create active monthly and yearly plans in the `subscription_plans` table.

For real payments, connect each plan to its Razorpay plan ID.

For local assessment without processing a real payment, set:

```env
ENABLE_DEMO_PAYMENTS=true
```

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

If port 3000 is already occupied, stop the existing process or use the URL displayed by Next.js.

## Test accounts

These accounts are intended only for assessment and demonstration.

### Administrator

```text
Email: testing@gmail.com
Password: <ADD-ADMIN-TEST-PASSWORD>
```

### Subscriber

```text
Email: surekha@gmail.com
Password: <ADD-SUBSCRIBER-TEST-PASSWORD>
```

Never use personal or production credentials as public test credentials.

## Important routes

| Route | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/signup` | Subscriber registration and charity selection |
| `/login` | Account login |
| `/dashboard` | Subscriber overview |
| `/account` | Profile and security settings |
| `/dashboard/scores` | Subscriber score management |
| `/charities` | Charity directory, search, filters, and selection |
| `/draws` | Draw eligibility, history, and results |
| `/subscribe` | Membership checkout and management |
| `/admin` | Administrator dashboard |
| `/admin/members` | Member management |
| `/admin/charities` | Charity management and contribution reporting |
| `/admin/draws` | Draw simulation and publication |
| `/admin/winners` | Winner verification and payout management |

## Draw eligibility

A subscriber is eligible for a monthly draw when all three conditions are satisfied:

1. The subscriber has an active membership.
2. The subscriber has selected a charity.
3. The subscriber has five valid Stableford scores.

Scores must be whole numbers from 1 to 45 and cannot use a future date.

## Payment modes

### Demo mode

When `ENABLE_DEMO_PAYMENTS=true`, the application can create simulated memberships without charging a real payment method. Demo subscriptions can be cancelled and reactivated through the interface.

### Razorpay mode

Real membership checkout uses Razorpay subscriptions.

The webhook endpoint is:

```text
/api/razorpay/webhook
```

Configure the same `RAZORPAY_WEBHOOK_SECRET` in both Razorpay and the deployment environment.

Webhook signatures are verified before subscription information is updated.

## Validation and security

- Authentication is verified on protected pages and API routes.
- Administrator routes require the administrator role.
- Protected server operations use the Supabase secret key.
- Users cannot manage another subscriber’s private data.
- Score values and dates are validated.
- Charity contributions are restricted to 10–100%.
- Duplicate score dates are rejected.
- Winner proof uploads restrict file type and size.
- Razorpay payment and webhook signatures are verified.
- Sensitive environment variables are never exposed to the browser.

## Quality checks

Run ESLint:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

Start the production build locally:

```bash
npm run start
```

## Deployment

The application is designed for deployment on Vercel.

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Add all required environment variables.
4. Deploy the project.
5. Add the production domain to the Supabase Authentication URL configuration.
6. Configure the Razorpay production webhook URL.
7. Test subscriber and administrator workflows on the deployed URL.

## Final verification checklist

- Signup creates a subscriber profile.
- Signup saves the selected charity and percentage.
- Login and logout work.
- Profile name and password can be updated.
- Scores can be created, edited, and deleted.
- Invalid, duplicate, and future-dated scores are rejected.
- Charity search and category filters work.
- Charity selection and percentage updates work.
- Demo and Razorpay membership flows work.
- Draw eligibility reflects scores, charity, and membership.
- Administrators can manage members and charities.
- Administrators can simulate and publish draws.
- Winner proof verification and payout tracking work.
- Mobile and desktop navigation work.
- `npm run lint` succeeds.
- `npm run build` succeeds.

## Author

Kajal Hatekar