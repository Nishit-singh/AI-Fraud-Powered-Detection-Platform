/**
 * AllTransactions.jsx — All Transactions page (Prompt 8)
 * Delegates to the shared TransactionTable component with no preset filters.
 */
import TransactionTable from '../components/TransactionTable';

export default function AllTransactions() {
  return (
    <TransactionTable
      pageIcon="📋"
      pageTitle="All Transactions"
      pageSubtitle="Browse, filter, and review every transaction processed by the platform — simulated, manual, and CSV batch."
      emptyMessage="No transactions found. Run a simulation or submit a manual prediction to get started."
    />
  );
}
