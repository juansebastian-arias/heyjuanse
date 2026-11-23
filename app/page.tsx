import { Product } from "@/components/flow/Product";
import { startView } from "@/lib/flow/view";
import { readTestReport } from "@/lib/server/tests";
import { SITE } from "@/site.config";

/**
 * The whole site is this one page: a company you can watch and change. Its first screen is
 * simulated when the site is built, so it arrives with real numbers and no spinner; everything
 * after that is simulated in the visitor's browser.
 */
export default function HomePage() {
  const report = readTestReport();
  const tests = report
    ? {
        total: report.total,
        passed: report.passed,
        failed: report.failed,
        files: report.files.length,
        ranAt: report.ranAt,
      }
    : null;
  return <Product initial={startView()} tests={tests} repository={SITE.repository} />;
}
