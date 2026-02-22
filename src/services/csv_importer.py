"""CSV import pipeline"""

import csv
from io import StringIO
from typing import List, Dict, Optional
from datetime import datetime
from decimal import Decimal
from uuid import uuid4

from src.domain.models import Transaction, Posting, TransactionStatus


class CSVImporter:
    """Import transactions from CSV"""

    def __init__(self, default_account_id: str = None, default_currency: str = "SGD"):
        """
        Initialize importer.
        
        Args:
            default_account_id: Default account UUID if not in CSV
            default_currency: Default currency for amounts
        """
        self.default_account_id = default_account_id
        self.default_currency = default_currency

    def import_transactions(
        self,
        csv_content: str,
        expense_account_id: str = None,
        column_mapping: Dict[str, str] = None
    ) -> List[Transaction]:
        """
        Import transactions from CSV content.
        
        Args:
            csv_content: CSV data as string
            expense_account_id: Account ID for counter-posting
            column_mapping: Map CSV columns to fields
                {
                    'date': 'timestamp',
                    'payee': 'payee',
                    'amount': 'amount',
                    ...
                }
            
        Returns:
            List of parsed Transaction objects
        """
        if column_mapping is None:
            column_mapping = self._default_column_mapping()

        transactions = []
        
        try:
            reader = csv.DictReader(StringIO(csv_content))
            
            for row in reader:
                try:
                    tx = self._parse_row(row, column_mapping, expense_account_id)
                    if tx:
                        transactions.append(tx)
                except Exception as e:
                    print(f"Warning: Failed to parse row {row}: {e}")
                    continue
            
            return transactions
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {e}")

    def _default_column_mapping(self) -> Dict[str, str]:
        """Default CSV column mapping"""
        return {
            'date': 'Date',
            'payee': 'Description',
            'amount': 'Amount',
            'memo': 'Notes'
        }

    def _parse_row(
        self,
        row: Dict[str, str],
        column_mapping: Dict[str, str],
        expense_account_id: str = None
    ) -> Optional[Transaction]:
        """Parse a single CSV row into Transaction"""
        
        # Parse date
        date_str = row.get(column_mapping.get('date', 'Date'), '')
        timestamp = self._parse_date(date_str)
        
        if not timestamp:
            return None
        
        # Parse amount
        amount_str = row.get(column_mapping.get('amount', 'Amount'), '0')
        amount = self._parse_amount(amount_str)
        
        payee = row.get(column_mapping.get('payee', 'Description'), '')
        memo = row.get(column_mapping.get('memo', 'Notes'), '')
        
        # Create double-entry transaction
        account_id = self.default_account_id
        counter_account_id = expense_account_id or str(uuid4())
        
        # Double-entry: bank amount matches CSV sign, counter-party gets opposite
        # Income (+): bank = +amount, counter = -amount
        # Expense (-): bank = -amount (negative CSV value), counter = +amount
        bank_amount = Decimal(str(amount))
        counter_amount = Decimal(str(-amount))

        posting1 = Posting(
            account_id=account_id,
            amount=bank_amount,
            currency=self.default_currency,
            base_amount=bank_amount
        )

        posting2 = Posting(
            account_id=counter_account_id,
            amount=counter_amount,
            currency=self.default_currency,
            base_amount=counter_amount
        )
        
        return Transaction(
            timestamp=timestamp,
            payee=payee,
            memo=memo,
            status=TransactionStatus.UNRECONCILED,
            source="csv_import",
            postings=[posting1, posting2]
        )

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string with multiple formats"""
        formats = [
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        return None

    def _parse_amount(self, amount_str: str) -> Decimal:
        """Parse amount string"""
        try:
            # Remove common currency symbols and whitespace
            cleaned = amount_str.replace('$', '').replace('€', '').replace('£', '')
            cleaned = cleaned.replace(',', '').strip()
            return Decimal(cleaned)
        except:
            return Decimal(0)
