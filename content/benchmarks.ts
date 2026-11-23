/**
 * Published figures the home page uses to show why answering a lead fast matters. They come from
 * one study and are quoted as published; nothing here comes from an employer or a client.
 */
export const RESPONSE_STUDY = {
  title: "The Short Life of Online Sales Leads",
  publication: "Harvard Business Review",
  date: "March 2011",
  url: "https://hbr.org/2011/03/the-short-life-of-online-sales-leads",
  /** US companies that were sent a test lead through their website. */
  companies: 2241,
  /** Average hours to a first reply, among the companies that replied within 30 days. */
  averageReplyHours: 42,
  /** Share of the companies that never replied. */
  neverReplied: 0.23,
  /**
   * Leads contacted within an hour were "nearly seven times as likely" to lead to a meaningful
   * conversation with a key decision maker as leads contacted an hour later.
   */
  withinHourMultiple: 7,
} as const;
