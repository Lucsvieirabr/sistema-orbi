type TxnLike = {
  id: string;
  type: string;
  category_id?: string | null;
  person_id?: string | null;
  is_shared?: boolean | null;
  linked_txn_id?: string | null;
};

/**
 * Ids das duas pernas de transferências entre contas. O Extrato grava a
 * transferência como par: saída (expense, sem categoria) + entrada (income,
 * sem categoria/pessoa, não compartilhada, `linked_txn_id` = saída). Rateio e
 * empréstimo também usam `linked_txn_id`, mas sempre têm categoria. Pernas de
 * transferência não são receita nem despesa: ficam fora dos agregados.
 */
export function transferLegIds(transactions: TxnLike[]): Set<string> {
  const ids = new Set<string>();
  for (const t of transactions) {
    if (t.type === "income" && t.linked_txn_id && !t.category_id && !t.person_id && !t.is_shared) {
      ids.add(t.id);
      ids.add(t.linked_txn_id);
    }
  }
  return ids;
}
