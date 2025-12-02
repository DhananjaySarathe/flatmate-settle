# ExpenseWaale - User Guide

Welcome to **ExpenseWaale**, your comprehensive expense splitting application! This guide will help you understand and use all the features to manage shared expenses with your flatmates, friends, or any group.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding Split Spaces](#understanding-split-spaces)
3. [Managing Flatmates](#managing-flatmates)
4. [Tracking Expenses](#tracking-expenses)
5. [Categories](#categories)
6. [Viewing Reports](#viewing-reports)
7. [Analytics Dashboard](#analytics-dashboard)
8. [Leaderboard & Fun Stats](#leaderboard--fun-stats)
9. [Tips & Best Practices](#tips--best-practices)

---

## Getting Started

### Creating Your Account

1. **Sign Up**: Click on "Sign Up" and enter your:

   - Email address
   - Password (make it strong!)
   - Full name (optional but recommended)

2. **Sign In**: If you already have an account, simply enter your email and password to log in.

3. **Welcome!**: Once you sign up, a **"Default" Split Space** is automatically created for you. This is your main space where you can start adding flatmates and expenses right away.

---

## Understanding Split Spaces

**Split Spaces** are like separate groups or projects where you can organize different sets of expenses. Think of them as different "rooms" or "contexts" for your expense tracking.

### Why Use Split Spaces?

- **Apartment Expenses**: Track rent, utilities, groceries for your apartment
- **Vacation Trips**: Keep travel expenses separate from daily living costs
- **Office Expenses**: Manage shared office costs with colleagues
- **Events**: Track expenses for parties, dinners, or special occasions

### Working with Split Spaces

#### Creating a New Split Space

1. Navigate to **Split Spaces** from the top navigation
2. Click **"Create SplitSpace"** button
3. Enter a name (e.g., "Summer Vacation 2024", "Office Team Lunch")
4. Click **"Create"**

#### Selecting a Split Space

- Use the **SplitSpace selector** at the top of the page (next to your name)
- Click on any Split Space to make it active
- All your actions (adding flatmates, expenses) will be scoped to the selected Split Space

#### Editing a Split Space

- Click the **"Edit"** button on any Split Space card
- Change the name and save

#### Deleting a Split Space

- Click the **"Delete"** button on a Split Space card
- **Note**: You can only delete Split Spaces that:
  - Are not named "Default" (the default space cannot be deleted)
  - Have no flatmates or expenses (you must remove them first)

---

## Managing Flatmates

**Flatmates** are the people you're splitting expenses with. They can be your actual flatmates, friends, family members, or anyone sharing costs with you.

### Adding a Flatmate

1. Go to the **Dashboard** page
2. Click **"Add Flatmate"** button
3. Fill in the information:
   - **Name** (required): The person's name
   - **Email** (optional): Their email address (useful for sending reports)
   - **Phone** (optional): Their phone number
4. Click **"Add Flatmate"**

**Important**: Flatmates are added to your currently selected Split Space. Make sure you have the right Split Space selected!

### Editing a Flatmate

- Click the **Edit** icon (pencil) on any flatmate card
- Update their information and save

### Deleting a Flatmate

- Click the **Delete** icon (trash) on a flatmate card
- Confirm the deletion

**Note**: If a flatmate has expenses associated with them, you may need to handle those expenses first.

---

## Tracking Expenses

The **Expenses** page is where you record all shared expenses and split them among your flatmates.

### Adding an Expense

1. Go to the **Expenses** page
2. Click **"Add Expense"** button
3. Fill in the expense details:

   - **Title**: What the expense is for (e.g., "Grocery Shopping", "Uber Ride")
   - **Amount**: The total cost (e.g., 150.00)
   - **Date**: When the expense occurred
   - **Paid By**: Who paid for this expense (select from your flatmates)
   - **Category**: Select a category (Food, Travel, Rent, Groceries, Utilities, Fuel, Shopping, Misc, or create a custom category)
   - **Split Between**: Select all the people who should share this cost
     - Use **"Select All"** button to quickly select everyone
     - Or check the boxes next to each flatmate's name individually
     - The amount will be automatically divided equally among selected people

4. Click **"Add Expense"**

### How Expense Splitting Works

- If an expense is **$100** and split between **4 people**, each person owes **$25**
- The person who paid gets credited for the full amount
- The system automatically calculates who owes what to whom

### Editing an Expense

- Click the **Edit** icon on any expense card
- Modify the details (including category) and save

### Deleting an Expense

- Click the **Delete** icon on an expense card
- Confirm the deletion

### Viewing Expenses

- Expenses are displayed as cards showing:
  - Title and category badge
  - Amount and date
  - Who paid
  - Who it was split between
  - Amount per person

---

## Categories

**Categories** help you organize and analyze your expenses. ExpenseWaale comes with 8 default categories, and you can create custom ones.

### Default Categories

- **Food**: Restaurants, takeout, food delivery
- **Travel**: Transportation, flights, hotels
- **Rent**: Housing costs
- **Groceries**: Supermarket shopping
- **Utilities**: Electricity, water, internet bills
- **Fuel**: Gas, petrol, charging
- **Shopping**: General purchases
- **Misc**: Everything else

### Custom Categories

- When adding an expense, select **"Add Custom Category"** from the category dropdown
- Enter a unique category name
- Your custom categories are available for all future expenses
- Custom categories can be deleted (default categories cannot)

### Using Categories

- Every expense must have a category (defaults to "Misc" if none selected)
- Categories help you:
  - Filter expenses in Reports and Analytics
  - Understand spending patterns
  - Generate category-wise insights

---

## Viewing Reports

The **Reports** page provides comprehensive insights into your expenses, balances, and settlement instructions with powerful filtering capabilities.

### Understanding the Reports Page

#### Date Range Selection

- Select a **start date** and **end date** to filter expenses
- By default, it shows expenses from the beginning of the current month to today
- All calculations and reports will be based on this date range
- **Your date range is saved** and will persist when you reload the page or navigate away

#### Advanced Filters

Click the **"Filters"** button in the Date Range card to open the Advanced Filters modal:

**People-Based Filters:**

- **Exact Match**: Show expenses split between ALL selected people (everyone must be involved)
- **Any Match**: Show expenses where ANY of the selected people are involved
- **Exclude**: Hide expenses involving these people (including expenses they paid for)
- **Paid By**: Show expenses paid by specific people (multi-select)

**Category Filters:**

- **Include Categories**: Show only expenses in these categories
- **Exclude Categories**: Hide expenses in these categories

**Filter Features:**

- Multiple filter types work together (AND logic)
- Filter badge shows the total number of active filters
- **Reset All Filters** button clears everything
- **Your filters are saved** and persist across page reloads

#### Filtered Transactions List

Below the date range selector, you'll see:

- All transactions matching your filters and date range
- Transaction count in the header
- Date range badge
- **Sort By** dropdown: Sort by Date (Newest/Oldest), Amount (High/Low), or Title (A-Z/Z-A)
- **Paid By** filter: Additional quick filter for who paid (multi-select)
- Each transaction shows:
  - Title and category badge
  - Date
  - Who paid
  - Who it was split between
  - Amount per person
  - Total amount

#### Balance Summary

This table shows:

- **Total Paid**: How much each person has paid
- **Total Owed**: How much each person owes (their share of expenses)
- **Net Balance**: The difference (positive = they're owed money, negative = they owe money)
- **Status**:
  - "Owes Money" = They should receive money
  - "Needs Money" = They need to pay money
  - "Settled" = They're all square

#### Settlement Instructions

This section shows exactly who needs to pay whom and how much:

- Example: "Alice → Bob: ₹250.00" means Alice should pay Bob ₹250
- The system calculates the minimum number of transactions needed to settle all balances

### Exporting Reports

#### Copy to Clipboard

1. **Copy Settlement Summary**: Copies a text summary of who owes what
2. **Copy All Expense Splitting**: Copies a detailed breakdown of all expenses grouped by who paid

These are useful for sharing via messaging apps or email.

#### Download PDF Reports

1. **All Expenses PDF**:

   - Detailed list of all filtered expenses in the date range
   - Shows date, description, category, who paid, who it was split with, and amounts
   - Perfect for record-keeping

2. **Balance Summary PDF**:
   - Complete settlement report
   - Includes balance summary, settlement instructions, and user-wise transaction details
   - Professional format suitable for sharing

#### Sending Reports via Email

1. Click **"Send via Email"** on the Balance Summary card
2. Select recipients (only flatmates with email addresses)
3. Choose email type:
   - **Comprehensive Report**: Same report sent to everyone
   - **Individual Reports**: Personalized summary for each person
4. Click **"Send Email"**

---

## Analytics Dashboard

The **Analytics** page provides deep insights into your spending patterns, trends, and financial health.

### Key Metrics

Four key cards show at a glance:

- **Total Expenses**: Sum of all filtered expenses
- **Avg per Day**: Average daily spending
- **Avg per Person**: Average spending per person
- **Fairness Score**: How evenly expenses are distributed (0-100, higher is more fair)

### Category Breakdown

- Visual progress bars showing spending per category
- Percentage of total expenses
- Number of expenses per category
- Sorted by total amount (highest first)

### Expense Trends Graph

- Beautiful area chart showing spending patterns over time
- **Period selector**: View by Day, Week, or Month
- Interactive tooltips showing exact amounts
- Smooth trend visualization
- Helps identify spending spikes and patterns

### Top 5 Most Expensive Days

- Lists the days with highest spending
- Shows total amount and number of expenses
- Helps identify expensive days or events

### Advanced Filtering

- Same powerful filters as Reports page
- Filters affect all analytics calculations
- Your filters persist across page reloads

### PDF Export

- Download comprehensive analytics summary
- Includes all metrics, category breakdown, and top days
- Professional format for sharing or record-keeping

---

## Leaderboard & Fun Stats

The **Leaderboard** page adds a fun, competitive element to expense tracking with badges and achievements.

### Top 3 Payers

- 🥇 Gold medal for the highest contributor
- 🥈 Silver medal for 2nd place
- 🥉 Bronze medal for 3rd place
- Shows total paid and number of expenses

### Fun Stats & Badges

**Main Badges:**

- **Most Generous**: Person who paid the most overall
- **Silent Assassin**: Person with lowest spending but still active
- **Big Spender**: Person with the highest single expense

**Category-Specific Badges:**

- **Milk Bhai** 🥛: Top spender in Groceries
- **Fuel King** ⛽: Top spender in Fuel
- **Foodie** 🍕: Top spender in Food

### PDF Export

- Download leaderboard as PDF
- Includes all rankings and badges
- Great for sharing achievements with your group!

---

## Tips & Best Practices

### Organizing Your Expenses

1. **Use Split Spaces Wisely**:

   - Keep different contexts separate (home vs. vacation)
   - Don't create too many spaces - it can get confusing

2. **Be Consistent with Names**:

   - Use consistent names for flatmates across all Split Spaces
   - Add email addresses for easy report sharing

3. **Use Categories Effectively**:

   - Assign appropriate categories to all expenses
   - Create custom categories for recurring expense types
   - Use categories to filter and analyze spending patterns

4. **Regular Updates**:
   - Add expenses as soon as they occur
   - Review balances regularly to avoid large settlements

### Managing Balances

1. **Settle Regularly**:

   - Don't let balances accumulate too much
   - Use the Reports page to see when settlements are needed

2. **Verify Before Settling**:

   - Check the Balance Summary before making payments
   - Use the Settlement Instructions for accurate amounts

3. **Keep Records**:
   - Download PDF reports for your records
   - They're useful for tax purposes or future reference

### Using Filters Effectively

1. **Filter Persistence**:

   - Your filters and date ranges are automatically saved
   - They persist when you reload the page or navigate away
   - Great for ongoing analysis of specific time periods or people

2. **Combining Filters**:

   - Use multiple filter types together for precise analysis
   - Example: Show only Food expenses paid by specific people in a date range

3. **Quick Filtering**:
   - Use the "Paid By" filter in the transactions table for quick filtering
   - Sort transactions to find specific expenses quickly

### Best Practices for Groups

1. **Clear Communication**:

   - Share reports with all flatmates regularly
   - Use email reports to keep everyone informed

2. **Fair Splitting**:

   - Make sure everyone agrees on how expenses are split
   - Some expenses might not need to be split equally (e.g., personal items)

3. **Default Split Space**:
   - Use your "Default" space for regular, ongoing expenses
   - Create new spaces for special occasions or separate groups

### Using Analytics

1. **Track Trends**:

   - Use the Expense Trends graph to identify spending patterns
   - Switch between Day/Week/Month views for different insights

2. **Category Analysis**:

   - Review category breakdown regularly
   - Identify areas where you're spending the most

3. **Fairness Monitoring**:
   - Check the Fairness Score to ensure balanced contributions
   - Use it to discuss expense distribution with your group

### Troubleshooting

**Can't delete a Split Space?**

- Make sure it's not named "Default" (this cannot be deleted)
- Remove all flatmates and expenses first

**Expense amounts seem wrong?**

- Check that you've selected the correct people in "Split Between"
- Verify the date range in Reports matches when expenses were added
- Check if filters are excluding relevant expenses

**Can't see expenses?**

- Make sure you have a Split Space selected
- Check that you're looking at the correct date range
- Review your filters - they might be hiding expenses

**Filters not working as expected?**

- Remember that multiple filter types use AND logic (all must match)
- Check if "Exclude" filters are hiding expenses you want to see
- Use "Reset All Filters" to start fresh

---

## Quick Reference

### Navigation

- **Dashboard**: Manage flatmates
- **Expenses**: Add and track expenses with categories
- **Reports**: View balances, filters, and download reports
- **Analytics**: Deep insights and spending trends
- **Leaderboard**: Fun stats and achievements
- **Split Spaces**: Create and manage expense groups

### Key Concepts

- **Split Space**: A group/context for organizing expenses
- **Flatmate**: A person you're splitting expenses with
- **Expense**: A shared cost that needs to be split
- **Category**: A label for organizing expenses (Food, Travel, etc.)
- **Balance**: The net amount someone owes or is owed
- **Settlement**: The transactions needed to balance everything out
- **Filter**: A way to show only specific expenses (by people, categories, dates)

### Filter Types

- **Exact Match**: Expenses where ALL selected people are involved
- **Any Match**: Expenses where ANY selected people are involved
- **Exclude**: Hide expenses involving selected people
- **Paid By**: Show expenses paid by specific people
- **Include Categories**: Show only expenses in these categories
- **Exclude Categories**: Hide expenses in these categories

---

## Need Help?

If you encounter any issues or have questions:

1. Check this guide for common solutions
2. Review your Split Space selection
3. Verify your date ranges and filters in Reports/Analytics
4. Make sure all required fields are filled when adding expenses
5. Try resetting filters if results seem unexpected

---

**Happy expense tracking! 🎉**

Remember: The goal is to make splitting expenses fair, easy, and transparent for everyone involved. Use filters, analytics, and reports to stay on top of your shared expenses!
