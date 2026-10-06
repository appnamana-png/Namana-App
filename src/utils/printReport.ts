import { CLINIC_CONFIG, MODALITIES_LIST } from '../constants';
import { TaxReportData } from './pdfTaxReport';
import { ReceiptData, Patient } from '../types';
import { loadClinicSettings, formatPatientId, parsePatientId } from './storage';

/**
 * Triggers a clean print dialog for the IT Return / Section 44ADA report
 * using a hidden iframe. This avoids parent container overflow clipping
 * and works reliably in iframe / embedded sandboxes.
 */
export function printTaxReportDocument(data: TaxReportData): void {
  const { selectedFY, fyMonths, totalGross, deemedIncome44ADA, totalVisits, uniquePatientsCount } = data;
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const totalInit = fyMonths.reduce((a, b) => a + b.initialFees, 0);
  const totalFollow = fyMonths.reduce((a, b) => a + b.followUpFees, 0);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>IT Return Audit Summary FY ${selectedFY}-${selectedFY + 1} - ${CLINIC_CONFIG.clinicName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .clinic-name {
      font-size: 20px;
      font-weight: 800;
      color: #0284c7;
      margin: 0 0 3px 0;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 11px;
      font-style: italic;
      font-weight: bold;
      margin: 0 0 4px 0;
    }
    .tag-red { color: #dc2626; }
    .tag-green { color: #16a34a; }
    .address {
      font-size: 9.5px;
      color: #334155;
      margin: 0 0 3px 0;
      line-height: 1.35;
    }
    .contact {
      font-size: 9.5px;
      font-weight: bold;
      color: #64748b;
      margin: 0;
    }
    .divider {
      height: 2px;
      background: #0284c7;
      margin: 8px 0 12px 0;
    }
    .title-banner {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 8px 12px;
      text-align: center;
      margin-bottom: 14px;
    }
    .title-banner h2 {
      margin: 0 0 3px 0;
      font-size: 13px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .title-banner p {
      margin: 0;
      font-size: 10px;
      color: #475569;
      font-weight: 600;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .stat-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 6px;
      text-align: center;
    }
    .stat-label {
      font-size: 8.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .stat-val {
      font-size: 14px;
      font-weight: 900;
      font-family: monospace, monospace;
      color: #0f172a;
    }
    .stat-val.amber { color: #b45309; }
    .stat-val.blue { color: #0369a1; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      margin-bottom: 14px;
    }
    th {
      background: #e0f2fe;
      color: #0369a1;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 9px;
      padding: 6px 8px;
      border-bottom: 1.5px solid #bae6fd;
      text-align: left;
    }
    th.right, td.right { text-align: right; }
    th.center, td.center { text-align: center; }
    td {
      padding: 5px 8px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    .total-row td {
      background: #f1f5f9 !important;
      font-weight: 800;
      color: #0f172a;
      border-top: 1.5px solid #cbd5e1;
      border-bottom: 1.5px solid #cbd5e1;
      font-size: 10.5px;
    }
    .ada-row td {
      background: #fef3c7 !important;
      font-weight: 800;
      color: #92400e;
      border-bottom: 1.5px solid #f59e0b;
      font-size: 11px;
    }
    .compliance-box {
      background: #fffbeb;
      border: 1px solid #fed7aa;
      border-radius: 6px;
      padding: 8px 12px;
      margin-bottom: 18px;
    }
    .compliance-title {
      font-size: 9px;
      font-weight: 800;
      color: #9a3412;
      margin-bottom: 3px;
    }
    .compliance-desc {
      font-size: 8.5px;
      color: #7c2d12;
      line-height: 1.4;
      margin: 0;
    }
    .sig-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 20px;
    }
    .sig-left {
      font-size: 9.5px;
      color: #475569;
      line-height: 1.5;
    }
    .sig-right {
      text-align: center;
      min-width: 180px;
    }
    .sig-line {
      border-bottom: 1px solid #64748b;
      margin-bottom: 4px;
    }
    .sig-name {
      font-size: 10px;
      font-weight: 800;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 8.5px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 class="clinic-name">${CLINIC_CONFIG.clinicName}</h1>
    <p class="address">${CLINIC_CONFIG.address.full}</p>
    <p class="contact">
      Consultant: <b>${CLINIC_CONFIG.consultantName || 'R. Chandrashekar'}</b> <span style="font-size: 10px; font-weight: normal; color: #475569;">${CLINIC_CONFIG.consultantEducation || 'BPT, MIAP'}</span> (${CLINIC_CONFIG.consultantTitle}) • Mob: ${CLINIC_CONFIG.phone}
      ${loadClinicSettings().gstNumber ? ` • <b>GSTIN: ${loadClinicSettings().gstNumber}</b>` : ''}
    </p>
  </div>

  <div class="divider"></div>

  <div class="title-banner">
    <h2>Annual Professional Receipts & Income Statement</h2>
    <p>Financial Year: ${selectedFY} - ${selectedFY + 1} &nbsp;|&nbsp; Assessment Year: ${selectedFY + 1} - ${selectedFY + 2} &nbsp;|&nbsp; Clinical Practice Record</p>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Gross Receipts</div>
      <div class="stat-val">₹${totalGross.toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Monthly Average</div>
      <div class="stat-val blue">₹${Math.round(totalGross / 12).toLocaleString()}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Unique Patients</div>
      <div class="stat-val blue">${uniquePatientsCount}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Clinical Sessions</div>
      <div class="stat-val">${totalVisits}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Financial Month</th>
        <th class="right">Initial Consultations (₹)</th>
        <th class="right">Follow-up Therapy (₹)</th>
        <th class="center">Sessions</th>
        <th class="right">Gross Receipts (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${fyMonths
        .map(
          (m) => `<tr>
        <td><b>${m.monthName}</b></td>
        <td class="right">₹${m.initialFees.toLocaleString()}</td>
        <td class="right">₹${m.followUpFees.toLocaleString()}</td>
        <td class="center">${m.patientVisits}</td>
        <td class="right"><b>₹${m.grossReceipts.toLocaleString()}</b></td>
      </tr>`
        )
        .join('')}
      <tr class="total-row">
        <td>TOTAL ANNUAL COLLECTIONS</td>
        <td class="right">₹${totalInit.toLocaleString()}</td>
        <td class="right">₹${totalFollow.toLocaleString()}</td>
        <td class="center">${totalVisits}</td>
        <td class="right">₹${totalGross.toLocaleString()}</td>
      </tr>
    </tbody>
  </table>

  <div class="compliance-box">
    <div class="compliance-title">ANNUAL CLINICAL PRACTICE CERTIFICATION:</div>
    <p class="compliance-desc">
      This annual statement summarizes bona fide professional collections from outpatient consultation and physiotherapy rehabilitation sessions conducted at Namana Physiotherapy Clinic during the stated financial year. All receipts correspond to authentic treatment records maintained in the clinical registry.
    </p>
  </div>

  <div class="sig-section">
    <div class="sig-left">
      <div><b>Place:</b> Mysuru, Karnataka</div>
      <div><b>Date of Statement:</b> ${todayStr}</div>
    </div>
    <div class="sig-right">
      <div class="sig-line"></div>
      <div class="sig-name">${CLINIC_CONFIG.consultantName || 'R. Chandrashekar'} <span style="font-size: 10px; font-weight: normal; color: #475569;">${CLINIC_CONFIG.consultantEducation || 'BPT, MIAP'}</span></div>
      <div class="sig-sub">${CLINIC_CONFIG.consultantTitle}</div>
      <div class="sig-sub">${CLINIC_CONFIG.clinicName}</div>
    </div>
  </div>
</body>
</html>`;

  // Create an iframe to safely isolate styles and trigger print
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed, falling back to window.print()', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 250);
    }
  } catch (err) {
    console.error('Error initiating print document:', err);
    window.print();
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

/**
 * Clean isolated printing of consultation & therapy receipt with official SVG logo
 */
export function printReceiptDocument(receipt: ReceiptData): void {
  const settings = loadClinicSettings();
  const gstToDisplay = receipt.gstNumber || (settings.showGstOnReceipt && settings.gstNumber ? settings.gstNumber : '');

  const rawReg = (receipt.regNo || '').trim();
  const parsedReg = parsePatientId(rawReg);
  const displayRegNo = parsedReg
    ? formatPatientId(receipt.date, parsedReg.seq)
    : rawReg || (receipt.serial ? formatPatientId(receipt.date, Number(receipt.serial)) : '—');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Receipt ${receipt.receiptNo || ''} - ${receipt.name || 'Patient'} - ${CLINIC_CONFIG.clinicName}</title>
  <style>
    @page {
      size: A5 portrait;
      margin: 8mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 6px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .outer-frame {
      border: 2px solid #0284c7;
      border-radius: 12px;
      padding: 12px 14px;
      box-sizing: border-box;
    }
    .inner-frame {
      border: 1px solid #bae6fd;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .logo-header {
      display: flex;
      align-items: center;
      gap: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .logo-svg-wrap {
      width: 58px;
      height: 58px;
      flex-shrink: 0;
    }
    .logo-svg-wrap svg {
      width: 100%;
      height: 100%;
    }
    .header-text {
      flex: 1;
    }
    .clinic-title {
      font-size: 16px;
      font-weight: 800;
      color: #0369a1;
      margin: 0 0 2px 0;
      letter-spacing: -0.3px;
    }
    .tagline {
      font-size: 9.5px;
      font-weight: bold;
      font-style: italic;
      margin: 0 0 3px 0;
    }
    .tag-red { color: #dc2626; }
    .tag-green { color: #16a34a; }
    .address-text {
      font-size: 8px;
      color: #334155;
      margin: 0 0 2px 0;
      line-height: 1.3;
    }
    .contact-text {
      font-size: 8px;
      font-weight: bold;
      color: #64748b;
      margin: 0;
    }
    .gst-badge {
      font-size: 8.5px;
      font-weight: bold;
      color: #0284c7;
      margin-top: 2px;
    }
    .receipt-banner {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      color: #0369a1;
      text-align: center;
      padding: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      border-radius: 6px;
      margin-bottom: 12px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .meta-item b {
      color: #475569;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9.5px;
      margin-bottom: 14px;
    }
    .details-table td {
      padding: 5px 6px;
      border-bottom: 1px solid #f1f5f9;
    }
    .details-table .label {
      width: 32%;
      color: #64748b;
      font-weight: 600;
    }
    .details-table .value {
      color: #0f172a;
      font-weight: 700;
    }
    .amount-box {
      background: #f8fafc;
      border: 1.5px solid #0284c7;
      border-radius: 8px;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .amount-label {
      font-size: 10px;
      font-weight: bold;
      color: #475569;
      text-transform: uppercase;
    }
    .amount-val {
      font-size: 16px;
      font-weight: 900;
      color: #0369a1;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 18px;
      padding-top: 8px;
    }
    .sig-block {
      text-align: center;
      min-width: 140px;
    }
    .sig-line {
      border-bottom: 1px solid #94a3b8;
      margin-bottom: 4px;
      height: 25px;
    }
    .sig-title {
      font-size: 9px;
      font-weight: 800;
      color: #0f172a;
    }
    .sig-sub {
      font-size: 8px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="outer-frame">
    <div class="inner-frame">
      <div class="logo-header">
        <div class="logo-svg-wrap">
          <img src="/clinic_logo.png" alt="Logo" style="width: 58px; height: 58px; object-fit: contain; border-radius: 50%;" />
        </div>
        <div class="header-text">
          <h1 class="clinic-title">${CLINIC_CONFIG.clinicName}</h1>
          <p class="address-text">${CLINIC_CONFIG.address.full}</p>
          <p class="contact-text">${CLINIC_CONFIG.services} • Phone: ${CLINIC_CONFIG.phone}</p>
          ${gstToDisplay ? `<div class="gst-badge">GSTIN: ${gstToDisplay}</div>` : ''}
        </div>
      </div>

      <div class="receipt-banner">CONSULTATION & PHYSIOTHERAPY RECEIPT</div>

      <div class="meta-row">
        <div class="meta-item"><b>Receipt No:</b> ${receipt.receiptNo || '—'}</div>
        <div class="meta-item"><b>Date:</b> ${receipt.date || new Date().toISOString().slice(0, 10)}</div>
        <div class="meta-item"><b>Visit Type:</b> ${receipt.visitType || 'Clinic'}</div>
      </div>

      <table class="details-table">
        <tr>
          <td class="label">Patient Name:</td>
          <td class="value">${receipt.name || '—'} (Reg No: ${displayRegNo})</td>
        </tr>
        ${receipt.age ? `<tr><td class="label">Age:</td><td class="value">${receipt.age} Years</td></tr>` : ''}
        <tr>
          <td class="label">Address / City:</td>
          <td class="value">${receipt.address || 'Mysuru, Karnataka'}</td>
        </tr>
        <tr>
          <td class="label">Clinical Service:</td>
          <td class="value">${receipt.therapyFor || 'Physiotherapy & Rehabilitation'}</td>
        </tr>
        <tr>
          <td class="label">Payment Mode:</td>
          <td class="value">${receipt.paymentMethod || 'Cash'}</td>
        </tr>
      </table>

      <div class="amount-box">
        <span class="amount-label">Total Amount Paid</span>
        <span class="amount-val">₹${parseFloat(String(receipt.amount || 0)).toLocaleString('en-IN')}</span>
      </div>

      <div class="footer-row">
        <div style="font-size: 8px; color: #94a3b8;">
          * Valid computerized clinic voucher.
        </div>
        <div class="sig-block">
          <div class="sig-line"></div>
          <div class="sig-title">Authorized Signatory</div>
          <div class="sig-sub" style="font-weight: 700; color: #1e293b;">${CLINIC_CONFIG.consultantName || 'R. Chandrashekar'} <span style="font-size: 8.5px; font-weight: normal; color: #64748b;">${CLINIC_CONFIG.consultantEducation || 'BPT, MIAP'}</span></div>
          <div class="sig-sub">${CLINIC_CONFIG.clinicName}</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 250);
    }
  } catch (err) {
    console.error('Error initiating print receipt:', err);
    window.print();
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

/**
 * Clean isolated printing of patient clinical case sheet with logo and GSTIN
 */
export function printCaseSheetDocument(patient: Patient): void {
  const settings = loadClinicSettings();
  const gstToDisplay = settings.showGstOnPatientData && settings.gstNumber ? settings.gstNumber : '';

  const activeModalities = MODALITIES_LIST.filter(
    (m) => patient.treatment && (patient.treatment as any)[m.key]
  ).map((m) => m.label);

  const followUps = patient.followUps || [];

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Case Sheet - ${patient.name || 'Patient'} (Reg #${patient.serial || '—'}) - ${CLINIC_CONFIG.clinicName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header {
      text-align: center;
      margin-bottom: 8px;
    }
    .logo-container {
      display: flex;
      justify-content: center;
      margin-bottom: 6px;
    }
    .clinic-name {
      font-size: 20px;
      font-weight: 800;
      color: #0284c7;
      margin: 0 0 2px 0;
      letter-spacing: -0.5px;
    }
    .tagline {
      font-size: 11px;
      font-style: italic;
      font-weight: bold;
      margin: 0 0 4px 0;
    }
    .tag-red { color: #dc2626; }
    .tag-green { color: #16a34a; }
    .address {
      font-size: 9.5px;
      color: #334155;
      margin: 0 0 3px 0;
      line-height: 1.35;
    }
    .contact {
      font-size: 9.5px;
      font-weight: bold;
      color: #64748b;
      margin: 0;
    }
    .divider {
      height: 2px;
      background: #0284c7;
      margin: 8px 0 12px 0;
    }
    .sheet-title {
      background: #f0f9ff;
      border: 1px solid #bae6fd;
      border-radius: 6px;
      padding: 6px 12px;
      text-align: center;
      font-size: 12px;
      font-weight: 800;
      color: #0369a1;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      color: #0369a1;
      border-bottom: 1.5px solid #e2e8f0;
      padding-bottom: 3px;
      margin: 12px 0 8px 0;
      text-transform: uppercase;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      font-size: 10.5px;
    }
    .grid-item {
      display: flex;
      gap: 6px;
    }
    .item-label {
      font-weight: 700;
      color: #475569;
      min-width: 100px;
    }
    .item-value {
      color: #0f172a;
      font-weight: 600;
    }
    .chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    }
    .chip {
      display: inline-block;
      padding: 3px 8px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      color: #166534;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
    }
    .clinical-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 10.5px;
      line-height: 1.45;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      text-align: left;
      padding: 5px 8px;
      border: 1px solid #cbd5e1;
    }
    td {
      padding: 5px 8px;
      border: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .footer-sig {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 24px;
      font-size: 9.5px;
    }
    .sig-line {
      width: 160px;
      border-top: 1px solid #94a3b8;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-container">
      <img src="/clinic_logo.png" alt="Logo" style="width: 52px; height: 52px; object-fit: contain; border-radius: 50%;" />
    </div>
    <h1 class="clinic-name">${CLINIC_CONFIG.clinicName}</h1>
    <p class="address">${CLINIC_CONFIG.address.full}</p>
    <p class="contact">
      Consultant: <b>${CLINIC_CONFIG.consultantName || 'R. Chandrashekar'}</b> <span style="font-size: 10px; font-weight: normal; color: #475569;">${CLINIC_CONFIG.consultantEducation || 'BPT, MIAP'}</span> (${CLINIC_CONFIG.consultantTitle}) • Mob: ${CLINIC_CONFIG.phone}
      ${gstToDisplay ? ` • <b>GSTIN: ${gstToDisplay}</b>` : ''}
    </p>
  </div>

  <div class="divider"></div>

  <div class="sheet-title">PATIENT OUTPATIENT CLINICAL CASE SHEET & REHABILITATION RECORD</div>

  <div class="section-title">Patient Profile & Demographics</div>
  <div class="grid-2">
    <div class="grid-item"><span class="item-label">Registration No:</span><span class="item-value font-mono"><b>${patient.regNo || formatPatientId(patient.date, patient.serial)}</b></span></div>
    <div class="grid-item"><span class="item-label">Consultation Date:</span><span class="item-value">${patient.date || '—'}</span></div>
    <div class="grid-item"><span class="item-label">Patient Name:</span><span class="item-value"><b>${patient.name || '—'}</b></span></div>
    <div class="grid-item"><span class="item-label">Age / Sex:</span><span class="item-value">${patient.age ? `${patient.age} Years` : '—'} / ${patient.sex || '—'}</span></div>
    <div class="grid-item"><span class="item-label">Contact Phone:</span><span class="item-value">${patient.contact || '—'}</span></div>
    <div class="grid-item"><span class="item-label">Address:</span><span class="item-value">${patient.address || 'Mysuru, Karnataka'}</span></div>
    <div class="grid-item"><span class="item-label">Referred By:</span><span class="item-value">${patient.referredBy || 'Self'}</span></div>
    <div class="grid-item"><span class="item-label">Blood Group:</span><span class="item-value">${patient.bloodGroup || '—'}</span></div>
    <div class="grid-item"><span class="item-label">Height / Weight:</span><span class="item-value">${patient.height || '—'} cm / ${patient.weight || '—'} kg</span></div>
    <div class="grid-item"><span class="item-label">Visit / Mode:</span><span class="item-value">${patient.visitType || 'Clinic'} (${patient.paymentMethod || 'Cash'})</span></div>
  </div>

  <div class="section-title">Clinical Diagnosis & Findings</div>
  <div class="grid-item" style="margin-bottom: 4px;">
    <span class="item-label">Primary Diagnosis:</span>
    <span class="item-value"><b>${patient.diagnosis || 'Physiotherapy Evaluation'}</b></span>
  </div>
  ${patient.history ? `
  <div style="margin-top: 6px;">
    <div style="font-size: 10px; font-weight: 700; color: #475569;">Clinical History & Condition:</div>
    <div class="clinical-box">${patient.history}</div>
  </div>` : ''}

  <div class="section-title">Prescribed Physiotherapy Modalities & Protocol</div>
  ${activeModalities.length > 0 ? `
  <div class="chips-wrap">
    ${activeModalities.map((m) => `<span class="chip">✓ ${m}</span>`).join('')}
  </div>` : '<p style="font-size: 10px; color: #64748b; margin: 4px 0;">No specific electrotherapy/exercise modalities checked.</p>'}

  ${followUps.length > 0 ? `
  <div class="section-title">Follow-up Sessions History (${followUps.length} Visits)</div>
  <table>
    <thead>
      <tr>
        <th style="width: 25px;">#</th>
        <th style="width: 80px;">Date</th>
        <th style="width: 70px;">Pain (0-10)</th>
        <th>Clinical Notes & Progress</th>
        <th style="width: 70px; text-align: right;">Fee (₹)</th>
      </tr>
    </thead>
    <tbody>
      ${followUps.map((fu, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${fu.date}</b></td>
        <td>${fu.painScale ?? '—'} / 10</td>
        <td>${fu.notes || '—'}</td>
        <td style="text-align: right;">₹${fu.fee || '0'}</td>
      </tr>`).join('')}
    </tbody>
  </table>` : ''}

  <div class="footer-sig">
    <div>
      <div><b>Clinic:</b> ${CLINIC_CONFIG.clinicName}</div>
      <div><b>Place:</b> Mysuru, Karnataka</div>
      <div><b>Printed:</b> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
    </div>
    <div style="text-align: center;">
      <div class="sig-line"></div>
      <div><b>${CLINIC_CONFIG.consultantName || 'R. Chandrashekar'}</b> <span style="font-size: 8.5px; font-weight: normal; color: #475569;">${CLINIC_CONFIG.consultantEducation || 'BPT, MIAP'}</span></div>
      <div style="color: #64748b; font-size: 8.5px;">${CLINIC_CONFIG.consultantTitle}</div>
      <div style="color: #64748b; font-size: 8px;">Reg No: KAPC/2018/PT-4421</div>
    </div>
  </div>
</body>
</html>`;

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          console.warn('Iframe print failed', e);
          window.print();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 1000);
        }
      }, 250);
    }
  } catch (err) {
    console.error('Error initiating print case sheet:', err);
    window.print();
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}
