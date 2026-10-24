import { jsPDF } from 'jspdf';

import type { DashboardRange, LiveFeedItem, OverviewData } from './api';

interface DashboardReportInput {
  overview: OverviewData;
  liveFeed: LiveFeedItem[];
  range: DashboardRange;
  generatedAt?: Date;
}

const COLORS = {
  ink: [17, 24, 39] as const,
  muted: [107, 114, 128] as const,
  border: [226, 232, 240] as const,
  panel: [248, 250, 252] as const,
  brand: [21, 107, 47] as const,
  good: [22, 163, 74] as const,
  bad: [220, 38, 38] as const,
  can: [37, 99, 235] as const,
};

const MATERIALS = [
  { key: 'pet_clean' as const, label: 'Good PET', points: 10, color: COLORS.good },
  { key: 'pet_bad' as const, label: 'Bad PET', points: 5, color: COLORS.bad },
  { key: 'aluminum' as const, label: 'Aluminum cans', points: 8, color: COLORS.can },
];

const rangeFileName: Record<DashboardRange, string> = {
  today: 'today',
  week: '7-days',
  month: '30-days',
  all: 'all-time',
};

const rangeReportLabel: Record<DashboardRange, string> = {
  today: 'Today',
  week: 'Last 7 days',
  month: 'Last 30 days',
  all: 'All time',
};

function dateText(value: Date): string {
  return value.toLocaleString('en-GB', {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function percent(value: number | null | undefined): string {
  return value == null ? 'Not available' : `${value}%`;
}

export function buildDashboardReport({
  overview,
  liveFeed,
  range,
  generatedAt = new Date(),
}: DashboardReportInput): jsPDF {
  const rangeLabel = rangeReportLabel[range];
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 0;

  doc.setProperties({
    title: `GreenGuard Detection Report - ${rangeLabel}`,
    subject: 'Smart recycling detection and material summary',
    author: 'GreenGuard AI Dashboard',
    creator: 'GreenGuard AI Dashboard',
  });

  const drawPageHeader = (firstPage: boolean) => {
    if (firstPage) {
      doc.setFillColor(...COLORS.brand);
      doc.rect(0, 0, pageWidth, 34, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(19);
      doc.text('GreenGuard Detection Report', margin, 15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Reporting period: ${rangeLabel}`, margin, 23);
      doc.text(`Generated: ${dateText(generatedAt)}`, margin, 28);
      y = 44;
      return;
    }

    doc.setFillColor(...COLORS.brand);
    doc.rect(0, 0, pageWidth, 17, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('GreenGuard Detection Report', margin, 11);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(rangeLabel, pageWidth - margin, 11, { align: 'right' });
    y = 25;
  };

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return;
    doc.addPage();
    drawPageHeader(false);
  };

  const sectionTitle = (title: string) => {
    ensureSpace(13);
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    doc.setDrawColor(...COLORS.border);
    doc.line(margin, y + 3, pageWidth - margin, y + 3);
    y += 10;
  };

  const summaryCard = (x: number, top: number, width: number, label: string, value: string, accent: readonly [number, number, number]) => {
    doc.setFillColor(...COLORS.panel);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, top, width, 20, 2, 2, 'FD');
    doc.setFillColor(...accent);
    doc.rect(x, top, 2, 20, 'F');
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 6, top + 7);
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(value, x + 6, top + 15);
  };

  drawPageHeader(true);
  sectionTitle('Executive summary');

  const total = overview.totalDetections ?? overview.todayDetections;
  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * 2) / 3;
  summaryCard(margin, y, cardWidth, 'Total detections', String(total), COLORS.brand);
  summaryCard(margin + cardWidth + cardGap, y, cardWidth, 'PET purity', percent(overview.purityRate), COLORS.good);
  summaryCard(margin + (cardWidth + cardGap) * 2, y, cardWidth, 'Bins online', overview.binsOnline, COLORS.can);
  y += 25;
  summaryCard(margin, y, cardWidth, 'Accept rate', percent(overview.acceptRate), COLORS.brand);
  summaryCard(
    margin + cardWidth + cardGap,
    y,
    cardWidth,
    'Average confidence',
    overview.avgConfidence == null ? 'Not available' : `${(overview.avgConfidence * 100).toFixed(1)}%`,
    COLORS.good,
  );
  summaryCard(
    margin + (cardWidth + cardGap) * 2,
    y,
    cardWidth,
    'Average AI speed',
    overview.avgFps == null ? 'Not available' : `${overview.avgFps} FPS`,
    COLORS.can,
  );
  y += 31;

  sectionTitle('Material breakdown');
  const materialTotal = MATERIALS.reduce((sum, material) => sum + overview.wasteBreakdown[material.key], 0);
  for (const material of MATERIALS) {
    const count = overview.wasteBreakdown[material.key];
    const share = materialTotal > 0 ? (count / materialTotal) * 100 : 0;
    const barWidth = Math.max(0, (contentWidth - 68) * (share / 100));
    ensureSpace(13);
    doc.setFillColor(material.color[0], material.color[1], material.color[2]);
    doc.roundedRect(margin, y - 3, 3, 8, 1, 1, 'F');
    doc.setTextColor(...COLORS.ink);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(material.label, margin + 7, y + 2);
    doc.setFillColor(235, 239, 244);
    doc.roundedRect(margin + 45, y - 2, contentWidth - 68, 5, 2, 2, 'F');
    if (barWidth > 0) {
      doc.setFillColor(material.color[0], material.color[1], material.color[2]);
      doc.roundedRect(margin + 45, y - 2, barWidth, 5, 2, 2, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.muted);
    doc.text(`${count} items | ${share.toFixed(1)}% | ${count * material.points} pts`, pageWidth - margin, y + 2, { align: 'right' });
    y += 12;
  }
  y += 4;

  sectionTitle('Detection timeline');
  const timelineColumns = [margin, margin + 45, margin + 78, margin + 111, margin + 144];
  const drawTimelineHeader = () => {
    doc.setFillColor(...COLORS.brand);
    doc.rect(margin, y - 5, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    ['Period', 'Good PET', 'Bad PET', 'Cans', 'Total'].forEach((label, index) => doc.text(label, timelineColumns[index] + 2, y));
    y += 7;
  };
  drawTimelineHeader();

  if (overview.classificationTrend.length === 0) {
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'italic');
    doc.text('No detections were recorded in this period.', margin + 2, y + 2);
    y += 10;
  } else {
    overview.classificationTrend.forEach((point, index) => {
      if (y + 8 > pageHeight - 18) {
        doc.addPage();
        drawPageHeader(false);
        drawTimelineHeader();
      }
      if (index % 2 === 1) {
        doc.setFillColor(...COLORS.panel);
        doc.rect(margin, y - 5, contentWidth, 8, 'F');
      }
      doc.setTextColor(...COLORS.ink);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      [point.label, point.pet_clean ?? 0, point.pet_bad ?? 0, point.aluminum ?? 0, point.value]
        .forEach((value, column) => doc.text(String(value), timelineColumns[column] + 2, y));
      y += 8;
    });
  }
  y += 7;

  sectionTitle('Recent detection events');
  const detectionRows = liveFeed.filter((item) => item.kind === 'detection').slice(0, 15);
  const eventColumns = [margin, margin + 40, margin + 86, margin + 124, margin + 153];
  const drawEventHeader = () => {
    doc.setFillColor(...COLORS.brand);
    doc.rect(margin, y - 5, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    ['Time', 'Material', 'Machine', 'Confidence', 'Decision'].forEach((label, index) => doc.text(label, eventColumns[index] + 2, y));
    y += 7;
  };
  drawEventHeader();

  if (detectionRows.length === 0) {
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'italic');
    doc.text('No recent detection events are available.', margin + 2, y + 2);
  } else {
    detectionRows.forEach((event, index) => {
      if (y + 8 > pageHeight - 18) {
        doc.addPage();
        drawPageHeader(false);
        drawEventHeader();
      }
      if (index % 2 === 1) {
        doc.setFillColor(...COLORS.panel);
        doc.rect(margin, y - 5, contentWidth, 8, 'F');
      }
      const material = MATERIALS.find((item) => item.key === event.detectedType);
      const confidence = event.confidence == null ? '-' : `${(event.confidence * 100).toFixed(1)}%`;
      const values = [
        new Date(event.time).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
        material?.label ?? 'Rejected',
        event.machineCode,
        confidence,
        event.decision === 'reject' ? 'Reject' : 'Accept',
      ];
      doc.setTextColor(...COLORS.ink);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      values.forEach((value, column) => doc.text(value, eventColumns[column] + 2, y));
      y += 8;
    });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.border);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setTextColor(...COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Generated by GreenGuard AI Dashboard', margin, pageHeight - 7);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  return doc;
}

export function exportDashboardReport(input: DashboardReportInput): string {
  const date = (input.generatedAt ?? new Date()).toISOString().slice(0, 10);
  const fileName = `GreenGuard-report-${rangeFileName[input.range]}-${date}.pdf`;
  buildDashboardReport(input).save(fileName);
  return fileName;
}
