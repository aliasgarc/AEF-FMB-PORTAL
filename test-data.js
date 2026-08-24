require('dotenv').config();
const db = require('./src/db');
const fs = require('fs');
const { parseCombinedExcel } = require('./src/utils/parsers');

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║         COMPREHENSIVE DATA VERIFICATION            ║');
console.log('╚════════════════════════════════════════════════════╝\n');

(async () => {
  try {
    // SECTION 1: Excel vs Database
    console.log('📊 SECTION 1: EXCEL vs DATABASE COMPARISON');
    console.log('─'.repeat(50));

    const buffer = fs.readFileSync('temp-excel.xlsx');
    const excelData = parseCombinedExcel(buffer);

    console.log(`\n📄 Excel File (temp-excel.xlsx):`);
    console.log(`   Total rows: ${excelData.rows.length}`);

    let excelTakhmeen = 0, excelPaid = 0, excelDue = 0;
    excelData.rows.forEach(row => {
      excelTakhmeen += parseFloat(row.takhmeen_amount || 0);
      excelPaid += parseFloat(row.paid || 0);
      excelDue += parseFloat(row.due || 0);
    });

    console.log(`   Takhmeen Total: ₹${excelTakhmeen.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
    console.log(`   Paid Total: ₹${excelPaid.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
    console.log(`   Due Total: ₹${excelDue.toLocaleString('en-IN', {minimumFractionDigits: 2})}`);

    // Get database totals
    const dbTotalsResult = await db.query(`
      SELECT
        (SELECT COUNT(DISTINCT hof_its) FROM fmb_takhmeen) as total_users,
        (SELECT SUM(takhmeen_amt::numeric) FROM fmb_takhmeen) as total_takhmeen,
        (SELECT SUM(amt_rcv::numeric) FROM fmb_payment_tbl) as total_paid,
        (SELECT SUM(amt_pending::numeric) FROM fmb_payment_tbl) as total_pending
    `);

    const dbTotals = dbTotalsResult.rows[0];
    console.log(`\n💾 Database:`);
    console.log(`   Total users: ${dbTotals.total_users}`);
    console.log(`   Takhmeen Total: ₹${Number(dbTotals.total_takhmeen).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
    console.log(`   Paid Total: ₹${Number(dbTotals.total_paid).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
    console.log(`   Pending Total: ₹${Number(dbTotals.total_pending).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);

    // Verification
    console.log(`\n✓ VERIFICATION:`);
    const takhmeenMatch = Math.abs(excelTakhmeen - Number(dbTotals.total_takhmeen)) < 1;
    const paidMatch = Math.abs(excelPaid - Number(dbTotals.total_paid)) < 1;
    const userCountMatch = excelData.rows.length === dbTotals.total_users;

    console.log(`   ${takhmeenMatch ? '✅' : '❌'} Takhmeen: ${takhmeenMatch ? 'MATCH' : 'MISMATCH'}`);
    if (!takhmeenMatch) console.log(`      Diff: ₹${Math.abs(excelTakhmeen - Number(dbTotals.total_takhmeen))}`);

    console.log(`   ${paidMatch ? '✅' : '❌'} Paid: ${paidMatch ? 'MATCH' : 'MISMATCH'}`);
    if (!paidMatch) console.log(`      Diff: ₹${Math.abs(excelPaid - Number(dbTotals.total_paid))}`);

    console.log(`   ${userCountMatch ? '✅' : '❌'} User Count: ${userCountMatch ? 'MATCH' : 'MISMATCH'}`);

    // SECTION 2: Sample users
    console.log(`\n\n📋 SECTION 2: SAMPLE USERS (First 5)`);
    console.log('─'.repeat(50));

    for (let i = 0; i < Math.min(5, excelData.rows.length); i++) {
      const excelRow = excelData.rows[i];
      const itsId = excelRow.its_id;

      const userCheckResult = await db.query(
        'SELECT id FROM fmb_its_tbl WHERE its_id = $1',
        [itsId]
      );

      if (userCheckResult.rows.length > 0) {
        const userId = userCheckResult.rows[0].id;
        const dataCheck = await db.query(`
          SELECT
            (SELECT takhmeen_amt::numeric FROM fmb_takhmeen WHERE hof_its = $1) as takhmeen,
            (SELECT amt_rcv::numeric FROM fmb_payment_tbl WHERE hof_its = $1) as paid
        `, [userId]);

        const dbRow = dataCheck.rows[0];
        const excelTakh = parseFloat(excelRow.takhmeen_amount || 0);
        const excelPd = parseFloat(excelRow.paid || 0);

        console.log(`\n${i + 1}. ITS ${itsId} - ${excelRow.full_name}`);
        console.log(`   Takhmeen: ${excelTakh === Number(dbRow.takhmeen || 0) ? '✅' : '❌'} ₹${excelTakh}`);
        console.log(`   Paid: ${excelPd === Number(dbRow.paid || 0) ? '✅' : '❌'} ₹${excelPd}`);
      }
    }

    // SECTION 3: Data integrity
    console.log(`\n\n🔒 SECTION 3: DATA INTEGRITY`);
    console.log('─'.repeat(50));

    const nullCheck = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM fmb_its_tbl WHERE its_id IS NULL) as missing_its,
        (SELECT COUNT(*) FROM fmb_takhmeen WHERE takhmeen_amt IS NULL) as missing_takhmeen,
        (SELECT COUNT(*) FROM fmb_payment_tbl WHERE amt_rcv IS NULL) as missing_payment
    `);

    const nullData = nullCheck.rows[0];
    console.log(`   ${nullData.missing_its === 0 ? '✅' : '❌'} Missing ITS data: ${nullData.missing_its}`);
    console.log(`   ${nullData.missing_takhmeen === 0 ? '✅' : '❌'} Missing takhmeen: ${nullData.missing_takhmeen}`);
    console.log(`   ${nullData.missing_payment === 0 ? '✅' : '❌'} Missing payment: ${nullData.missing_payment}`);

    const dupCheck = await db.query(`
      SELECT COUNT(*) as dups FROM (
        SELECT hof_its FROM fmb_takhmeen GROUP BY hof_its HAVING COUNT(*) > 1
      ) t
    `);

    console.log(`   ${dupCheck.rows[0].dups === 0 ? '✅' : '❌'} Duplicate records: ${dupCheck.rows[0].dups}`);

    // Final summary
    console.log(`\n\n✨ FINAL RESULT`);
    console.log('═'.repeat(50));

    if (takhmeenMatch && paidMatch && userCountMatch && nullData.missing_its === 0 && dupCheck.rows[0].dups === 0) {
      console.log('✅ ALL CHECKS PASSED - DATA CORRECTLY LOADED!\n');
      console.log(`✅ ${excelData.rows.length} users imported`);
      console.log(`✅ Takhmeen: ₹${Number(dbTotals.total_takhmeen).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      console.log(`✅ Paid: ₹${Number(dbTotals.total_paid).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      console.log(`✅ Pending: ₹${Number(dbTotals.total_pending).toLocaleString('en-IN', {minimumFractionDigits: 2})}`);
      console.log(`✅ No duplicates, no missing data`);
    } else {
      console.log('⚠️  SOME CHECKS FAILED');
    }

    console.log('\n═'.repeat(50) + '\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
})();
