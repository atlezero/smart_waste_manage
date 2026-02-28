import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET(request: NextRequest) {
    try {
        const { error } = await supabaseServer.rpc('execute_sql', {
            query: 'ALTER TABLE bins ADD COLUMN created_by TEXT; ALTER TABLE bins ADD COLUMN created_by_role TEXT;'
        });

        if (error) {
            if (error.message.includes('already exists')) {
                return NextResponse.json({ success: true, message: 'Column created_by already exists' });
            }
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Columns added successfully' });
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
