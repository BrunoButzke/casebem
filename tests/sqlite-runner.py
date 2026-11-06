#!/usr/bin/env python3
"""
Execute D1 migrations against SQLite and verify column compatibility.
This validates that SQL statements match migration schema exactly.
"""
import sqlite3
import sys
import json
from pathlib import Path

def main():
    # Create in-memory database
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    try:
        # Execute migration 0001
        migration_0001 = Path('migrations/0001_rsvps.sql').read_text()
        cursor.executescript(migration_0001)
        
        # Execute migration 0002
        migration_0002 = Path('migrations/0002_idempotency_and_encryption.sql').read_text()
        cursor.executescript(migration_0002)
        
        # Verify rsvps table columns
        cursor.execute("PRAGMA table_info(rsvps)")
        columns = [row[1] for row in cursor.fetchall()]
        
        expected_columns = [
            'id', 'wedding_key', 'guest_name', 'attending',
            'adults_count', 'children_count', 'observations',
            'consent_given', 'manage_token_hash', 'created_at', 'updated_at',
            'idempotency_key', 'idempotency_fingerprint'
        ]
        
        if columns != expected_columns:
            print(json.dumps({
                'success': False,
                'error': f'Column mismatch. Expected: {expected_columns}, Got: {columns}'
            }))
            sys.exit(1)
        
        # Verify INSERT with 13 placeholders matches 13 columns
        insert_sql = """
        INSERT INTO rsvps (
          id, wedding_key, guest_name, attending,
          adults_count, children_count, observations,
          consent_given, manage_token_hash, created_at, updated_at,
          idempotency_key, idempotency_fingerprint
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """
        
        cursor.execute(insert_sql, (
            'test-id', 'dani-carine', 'Test Guest', 1,
            2, 0, 'Test observation',
            1, 'hash-value', 1234567890, 1234567890,
            'idem-key', 'fingerprint'
        ))
        
        # Verify SELECT without manage_token_encrypted
        select_sql = """
        SELECT id, guest_name, attending, adults_count, children_count,
               observations, manage_token_hash, created_at, updated_at,
               idempotency_fingerprint
        FROM rsvps
        WHERE wedding_key = ?
        """
        
        cursor.execute(select_sql, ('dani-carine',))
        row = cursor.fetchone()
        
        if not row:
            print(json.dumps({
                'success': False,
                'error': 'INSERT succeeded but SELECT returned no rows'
            }))
            sys.exit(1)
        
        # Verify CHECK constraint (attending=1 OR counts=0)
        try:
            cursor.execute(insert_sql, (
                'test-id-2', 'dani-carine', 'Invalid Guest', 0,
                1, 0, 'Should fail',
                1, 'hash-value-2', 1234567890, 1234567890,
                'idem-key-2', 'fingerprint-2'
            ))
            print(json.dumps({
                'success': False,
                'error': 'CHECK constraint not enforced (attending=0 with counts>0)'
            }))
            sys.exit(1)
        except sqlite3.IntegrityError:
            pass  # Expected
        
        print(json.dumps({
            'success': True,
            'columns': columns,
            'row_count': 1
        }))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
