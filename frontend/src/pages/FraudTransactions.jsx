/**
 * FraudTransactions.jsx — Fraud-only view (Prompt 9)
 *
 * Pre-filters: is_fraud=true (locked)
 * Hidden controls: prediction filter (redundant — always fraud)
 */
import TransactionTable from '../components/TransactionTable';

export default function FraudTransactions() {
  return (
    <TransactionTable
      pageIcon="🚨"
      pageTitle="Fraud Transactions"
      pageSubtitle="All transactions flagged as fraudulent by the model. Use the risk level and source filters to narrow results."
      presetFilters={{ prediction: 'fraud' }}
      hiddenFilters={['prediction']}
      emptyMessage="No fraudulent transactions found. Run a simulation to generate sample data."
    />
  );
}
