import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createIssueTicket, executeTriageAction } from '../lib/issueTriage';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function runTest() {
  console.log('=== TEST 1: Simulate Casual Talk (Should be filtered out) ===');
  const chitChatResult = await createIssueTicket({
    rawText: 'ok boss, terima kasih',
    senderName: 'yan',
    senderPhone: '60123456789'
  });
  console.log('Chit-chat ticket result (expect null):', chitChatResult);

  console.log('\n=== TEST 2: Simulate Real Bug / Complaint: Lori 9821 Overload ===');
  const ticket1 = await createIssueTicket({
    rawText: 'Boss, lori 9821 takleh loading barang, sistem tulis terlebih muatan 70 roll.',
    senderName: 'yan (Pemandu)',
    senderPhone: '60123456789',
    groupId: '120363048912345678@g.us'
  });
  console.log('Created Ticket 1:', ticket1?.ticket_number);
  console.log('AI Diagnosis:', ticket1?.ai_diagnosis);
  console.log('Option 1 Action:', ticket1?.option_1_action);
  console.log('Option 2 Reply:', ticket1?.option_2_reply);
  console.log('Option 3 Bug:', ticket1?.option_3_bug);

  if (ticket1?.id) {
    console.log('\n=== TEST 3: Execute Option 1 (One-click Fix) on Ticket 1 ===');
    const actResult = await executeTriageAction({
      ticketId: ticket1.id,
      actionOption: 1,
      resolvedBy: 'Max Tan (Admin)'
    });
    console.log('Execution result:', actResult);
  }

  console.log('\n=== All Triage Service Tests Completed! ===');
}

runTest().catch(console.error);
