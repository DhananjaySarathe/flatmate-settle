import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  recipients: string[];
  emailType: 'individual' | 'comprehensive';
  reportData: {
    expenses: any[];
    balances: any[];
    settlements: any[];
    dateRange: {
      from: string;
      to: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { recipients, emailType, reportData }: EmailRequest = await req.json()

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get flatmate details for recipients
    const { data: flatmates, error: flatmatesError } = await supabaseClient
      .from('flatmates')
      .select('id, name, email')
      .in('id', recipients)

    if (flatmatesError) {
      throw flatmatesError
    }

    const flatmatesWithEmails = flatmates?.filter(f => f.email) || []

    if (flatmatesWithEmails.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No recipients with email addresses found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate email content based on type
    const emailPromises = flatmatesWithEmails.map(async (flatmate) => {
      const { email, name } = flatmate
      
      let subject: string
      let htmlContent: string

      if (emailType === 'individual') {
        // Find this flatmate's balance
        const balance = reportData.balances.find(b => b.id === flatmate.id)
        const settlements = reportData.settlements.filter(s => s.from === name || s.to === name)
        
        subject = `Your FlatShare Settlement Summary - ${reportData.dateRange.from} to ${reportData.dateRange.to}`
        
        htmlContent = generateIndividualEmailHTML(name, balance, settlements, reportData)
      } else {
        subject = `FlatShare Settlement Report - ${reportData.dateRange.from} to ${reportData.dateRange.to}`
        htmlContent = generateComprehensiveEmailHTML(reportData)
      }

      // Send email using Supabase Auth (you might need to configure email templates)
      const { error: emailError } = await supabaseClient.auth.admin.sendEmail({
        email: email!,
        subject,
        html: htmlContent,
      })

      if (emailError) {
        console.error(`Failed to send email to ${email}:`, emailError)
        throw emailError
      }

      return { email, success: true }
    })

    const results = await Promise.allSettled(emailPromises)
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    return new Response(
      JSON.stringify({
        message: `Emails sent successfully`,
        sent: successful,
        failed: failed,
        total: flatmatesWithEmails.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error sending emails:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to send emails' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function generateIndividualEmailHTML(name: string, balance: any, settlements: any[], reportData: any): string {
  const totalExpenses = reportData.expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0)
  const dateRange = `${new Date(reportData.dateRange.from).toLocaleDateString()} - ${new Date(reportData.dateRange.to).toLocaleDateString()}`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Your FlatShare Settlement</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a855f7, #3b82f6); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .content { background: #f9f9f9; padding: 25px; border-radius: 10px; margin-bottom: 20px; }
        .balance-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #a855f7; margin: 15px 0; }
        .settlement-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 15px 0; }
        .amount { font-size: 24px; font-weight: bold; }
        .positive { color: #22c55e; }
        .negative { color: #ef4444; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        .expense-list { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .expense-item { padding: 8px 0; border-bottom: 1px solid #eee; }
        .expense-item:last-child { border-bottom: none; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏠 FlatShare Settlement Report</h1>
        <p>Personal Summary for ${name}</p>
        <p><small>Period: ${dateRange}</small></p>
      </div>

      <div class="content">
        <h2>Your Balance Summary</h2>
        ${balance ? `
          <div class="balance-card">
            <h3>Your Financial Status</h3>
            <p><strong>Total Paid:</strong> $${balance.totalPaid.toFixed(2)}</p>
            <p><strong>Total Owed:</strong> $${balance.totalOwed.toFixed(2)}</p>
            <p><strong>Net Balance:</strong> 
              <span class="amount ${balance.balance >= 0 ? 'positive' : 'negative'}">
                ${balance.balance >= 0 ? '+' : ''}$${balance.balance.toFixed(2)}
              </span>
            </p>
            <p><em>${balance.balance > 0 ? 'You are owed money' : balance.balance < 0 ? 'You owe money' : 'You are all settled up!'}</em></p>
          </div>
        ` : '<p>No balance information available.</p>'}

        ${settlements.length > 0 ? `
          <h2>Your Settlement Instructions</h2>
          ${settlements.map(settlement => `
            <div class="settlement-card">
              <h3>${settlement.from === name ? 'You need to pay' : 'You will receive payment'}</h3>
              <p><strong>${settlement.from === name ? 'Pay to' : 'Receive from'}:</strong> ${settlement.from === name ? settlement.to : settlement.from}</p>
              <p><strong>Amount:</strong> <span class="amount">$${settlement.amount.toFixed(2)}</span></p>
            </div>
          `).join('')}
        ` : balance?.balance === 0 ? `
          <div class="settlement-card">
            <h3>🎉 All Settled Up!</h3>
            <p>No money needs to be transferred for you.</p>
          </div>
        ` : ''}

        <h2>Expense Overview</h2>
        <div class="expense-list">
          <p><strong>Total Expenses:</strong> $${totalExpenses.toFixed(2)}</p>
          <p><strong>Number of Expenses:</strong> ${reportData.expenses.length}</p>
          <p><strong>Average per Expense:</strong> $${(totalExpenses / reportData.expenses.length).toFixed(2)}</p>
        </div>

        ${reportData.expenses.length > 0 ? `
          <h3>Recent Expenses</h3>
          <div class="expense-list">
            ${reportData.expenses.slice(0, 5).map((expense: any) => `
              <div class="expense-item">
                <strong>${expense.title}</strong> - $${expense.amount.toFixed(2)}<br>
                <small>Paid by ${expense.flatmates.name} on ${new Date(expense.date).toLocaleDateString()}</small>
              </div>
            `).join('')}
            ${reportData.expenses.length > 5 ? `<p><em>... and ${reportData.expenses.length - 5} more expenses</em></p>` : ''}
          </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Generated by FlatShare Expense Management System</p>
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </body>
    </html>
  `
}

function generateComprehensiveEmailHTML(reportData: any): string {
  const totalExpenses = reportData.expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0)
  const dateRange = `${new Date(reportData.dateRange.from).toLocaleDateString()} - ${new Date(reportData.dateRange.to).toLocaleDateString()}`
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>FlatShare Settlement Report</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #a855f7, #3b82f6); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
        .content { background: #f9f9f9; padding: 25px; border-radius: 10px; margin-bottom: 20px; }
        .balance-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #a855f7; margin: 15px 0; }
        .settlement-card { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 15px 0; }
        .amount { font-size: 20px; font-weight: bold; }
        .positive { color: #22c55e; }
        .negative { color: #ef4444; }
        .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        .expense-list { background: white; padding: 15px; border-radius: 8px; margin: 10px 0; }
        .expense-item { padding: 8px 0; border-bottom: 1px solid #eee; }
        .expense-item:last-child { border-bottom: none; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f8f9fa; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🏠 FlatShare Settlement Report</h1>
        <p>Complete Settlement Summary</p>
        <p><small>Period: ${dateRange}</small></p>
      </div>

      <div class="content">
        <h2>Balance Summary</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Total Paid</th>
              <th>Total Owed</th>
              <th>Net Balance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.balances.map((balance: any) => `
              <tr>
                <td>${balance.name}</td>
                <td>$${balance.totalPaid.toFixed(2)}</td>
                <td>$${balance.totalOwed.toFixed(2)}</td>
                <td><span class="amount ${balance.balance >= 0 ? 'positive' : 'negative'}">${balance.balance >= 0 ? '+' : ''}$${balance.balance.toFixed(2)}</span></td>
                <td>${balance.balance > 0 ? 'Owes Money' : balance.balance < 0 ? 'Needs Money' : 'Settled'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h2>Settlement Instructions</h2>
        ${reportData.settlements.length > 0 ? `
          ${reportData.settlements.map((settlement: any, index: number) => `
            <div class="settlement-card">
              <h3>${index + 1}. ${settlement.from} → ${settlement.to}</h3>
              <p><strong>Amount to Transfer:</strong> <span class="amount">$${settlement.amount.toFixed(2)}</span></p>
              <p><em>${settlement.from} should pay ${settlement.to} $${settlement.amount.toFixed(2)}</em></p>
            </div>
          `).join('')}
          <div class="settlement-card">
            <h3>Summary</h3>
            <p><strong>Total settlements:</strong> ${reportData.settlements.length} transactions</p>
            <p><strong>Total amount to be transferred:</strong> $${reportData.settlements.reduce((sum: number, s: any) => sum + s.amount, 0).toFixed(2)}</p>
          </div>
        ` : `
          <div class="settlement-card">
            <h3>🎉 All Settled Up!</h3>
            <p>No money needs to be transferred between flatmates.</p>
          </div>
        `}

        <h2>Expense Overview</h2>
        <div class="expense-list">
          <p><strong>Total Expenses:</strong> $${totalExpenses.toFixed(2)}</p>
          <p><strong>Number of Expenses:</strong> ${reportData.expenses.length}</p>
          <p><strong>Average per Expense:</strong> $${(totalExpenses / reportData.expenses.length).toFixed(2)}</p>
        </div>

        ${reportData.expenses.length > 0 ? `
          <h3>All Expenses</h3>
          <div class="expense-list">
            ${reportData.expenses.map((expense: any) => `
              <div class="expense-item">
                <strong>${expense.title}</strong> - $${expense.amount.toFixed(2)}<br>
                <small>Paid by ${expense.flatmates.name} on ${new Date(expense.date).toLocaleDateString()} • Split between ${expense.expense_splits.length} people • $${(expense.amount / expense.expense_splits.length).toFixed(2)} each</small>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="footer">
        <p>Generated by FlatShare Expense Management System</p>
        <p>This is an automated email. Please do not reply to this message.</p>
      </div>
    </body>
    </html>
  `
}
