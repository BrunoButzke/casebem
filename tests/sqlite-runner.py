#!/usr/bin/env python3
"""
Execute D1 migrations against SQLite and verify column compatibility.
This validates that SQL statements match migration schema exactly.

Can be used in two modes:
1. No arguments: Run full RSVP schema validation (for backward compatibility)
2. With SQL argument: Execute arbitrary SQL and return results
"""
import sqlite3
import sys
import json
from pathlib import Path

def execute_sql_query(sql):
    """Execute arbitrary SQL query and return results"""
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    try:
        # Always load all migrations first for queries that expect tables
        try:
            migration_0001 = Path('migrations/0001_rsvps.sql').read_text()
            cursor.executescript(migration_0001)
        except:
            pass
            
        try:
            migration_0002 = Path('migrations/0002_idempotency_and_encryption.sql').read_text()
            cursor.executescript(migration_0002)
        except:
            pass
            
        try:
            migration_0003 = Path('migrations/0003_messages.sql').read_text()
            cursor.executescript(migration_0003)
        except:
            pass
        
        # Check if it looks like a migration script (CREATE, INSERT, multiple statements)
        is_script = ('CREATE TABLE' in sql.upper() or 
                     'CREATE INDEX' in sql.upper() or 
                     'INSERT INTO' in sql.upper() or
                     sql.count(';') > 1)
        
        if is_script:
            # Multiple statements - use executescript
            cursor.executescript(sql)
            conn.commit()
            # No output for script execution (silent success)
        else:
            # Single query - use execute to get results
            cursor.execute(sql)
            conn.commit()
            
            # Try to get results
            rows = cursor.fetchall()
            if rows and cursor.description:
                # Format as simple text output
                output_lines = []
                for row in rows:
                    output_lines.append('\t'.join(str(v) for v in row))
                print('\n'.join(output_lines))
        
    except Exception as e:
        # Print error to stderr so tests can detect it
        sys.stderr.write(str(e) + '\n')
        sys.exit(1)
    finally:
        conn.close()

def validate_rsvp_schema():
    """Original RSVP schema validation (for backward compatibility)"""
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

def execute_batch(commands):
    """Execute multiple SQL commands in sequence on the same DB"""
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    
    try:
        # Load all migrations
        try:
            migration_0001 = Path('migrations/0001_rsvps.sql').read_text()
            cursor.executescript(migration_0001)
        except:
            pass
            
        try:
            migration_0002 = Path('migrations/0002_idempotency_and_encryption.sql').read_text()
            cursor.executescript(migration_0002)
        except:
            pass
            
        try:
            migration_0003 = Path('migrations/0003_messages.sql').read_text()
            cursor.executescript(migration_0003)
        except:
            pass
        
        # Execute commands in sequence
        results = []
        for i, sql in enumerate(commands):
            try:
                cursor.execute(sql)
                conn.commit()
                results.append({"success": True})
            except sqlite3.IntegrityError as e:
                results.append({"success": False, "error": str(e)})
            except Exception as e:
                results.append({"success": False, "error": str(e)})
        
        # Print results as JSON
        print(json.dumps({"results": results}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()

def main():
    # Check for batch mode (stdin JSON)
    if len(sys.argv) > 1 and sys.argv[1] == '--batch':
        try:
            batch_input = json.load(sys.stdin)
            execute_batch(batch_input['commands'])
        except Exception as e:
            print(json.dumps({"success": False, "error": str(e)}), file=sys.stderr)
            sys.exit(1)
    # Check if SQL query was provided as argument
    elif len(sys.argv) > 1:
        sql = sys.argv[1]
        execute_sql_query(sql)
    else:
        # Run original RSVP schema validation
        validate_rsvp_schema()

if __name__ == '__main__':
    main()
