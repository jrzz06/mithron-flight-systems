"use client";

type InvoiceHtmlViewerProps = {
  html: string;
};

export function InvoiceHtmlViewer({ html }: InvoiceHtmlViewerProps) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
