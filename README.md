# Personal Financial Tracker

## Problem Statement 
People don’t track expenses properly because:

* They forget daily small expenses
* Manual entry feels like work
* No quick way to log spending in real-time
* No clear visualization of where money goes

## DESCRIPTION 
In today’s fast-paced lifestyle, individuals frequently engage in numerous small and scattered financial transactions throughout the day—such as food purchases, transportation, subscriptions, and miscellaneous expenses. However, most users fail to accurately track these expenditures due to the inconvenience and effort required for manual data entry.

Traditional expense tracking systems rely heavily on users to input data manually, which leads to several challenges:

* Users often forget to record expenses in real-time
* Manual entry is time-consuming and repetitive
* Lack of motivation due to no immediate feedback
* Difficulty in categorizing and analyzing spending patterns
* Limited accessibility for quick and natural input methods

As a result, users lack a clear understanding of their financial habits, leading to poor budgeting, uncontrolled spending, and reduced financial awareness.

Furthermore, this application integrates modern interaction methods such as voice input and automated receipt scanning, which significantly reduce user effort and improve data accuracy.

## 🚀 Tech Stack

* Frontend: React (Vite)
* Styling: Tailwind CSS
* Database & Backend: Firebase (Firestore, Auth, Storage)
* AI Integration: Google Gemini API (for receipt/voice parsing)

## 📂 Project Structure

```
├── src/
│   ├── components/     # Dashboard, Forms, VoiceUI, Scanner
│   ├── lib/            # Utilities (Gemini service, Firebase service)
│   ├── types.ts        # TypeScript interfaces
│   └── App.tsx         # Main application component
├── firestore.rules     # Firebase Security Rules
└── firebase-blueprint.json # Data model blueprint
```

## 🏗️ System Architecture

1. **User Authentication (Firebase Auth)**
   * Secure entry point via Google Authentication.

2. **Core Modules**
   * **Dashboard:** Displays Total Balance, Monthly Expenses, All-Time Expenses, and a "Recent Expenses" table with CRUD functionality.
   * **Add Expense:** A standard form to manually input title, amount, category, and date.
   * **Reports & Filtering:** Visual charts (Pie/Bar) and date filters to analyze spending habits.

3. **Advanced Features**
   * **Voice Recognition:** Integration to "talk" to the app (e.g., "I spent 200 rupees on lunch today") to automatically parse and save data using Gemini.
   * **Receipt Scanning:** Functionality to use the camera to scan receipts or upload files for batch expense processing using Gemini.
   * **Serverless Architecture:** Direct SDK integration with Firebase Firestore for real-time data synchronization.
