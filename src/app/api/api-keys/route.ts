import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

// POST - Generate API Key ใหม่สำหรับถังขยะ (regenerate)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { binId } = body;

        if (!binId) {
            return NextResponse.json(
                { success: false, error: 'Bin ID is required' },
                { status: 400 }
            );
        }

        // Generate new API Key
        const newApiKey = 'swm_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');

        // อัปเดต API Key ใน database
        const { data: bin, error } = await supabaseServer
            .from('bins')
            .update({
                api_key: newApiKey,
                updated_at: new Date().toISOString(),
            })
            .eq('id', binId)
            .select()
            .single();

        if (error) throw error;

        if (!bin) {
            return NextResponse.json(
                { success: false, error: 'Bin not found' },
                { status: 404 }
            );
        }

        console.log(`🔑 Regenerated API Key for bin ${bin.name}: ${newApiKey.substring(0, 12)}...`);

        return NextResponse.json({
            success: true,
            data: {
                binId: bin.id,
                binName: bin.name,
                apiKey: newApiKey,
            },
        });
    } catch (error) {
        console.error('Error regenerating API Key:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to regenerate API Key' },
            { status: 500 }
        );
    }
}

// GET - ดึง API Keys ของถังขยะทั้งหมด
export async function GET() {
    try {
        const { data: bins, error } = await supabaseServer
            .from('bins')
            .select('id, api_key, name, address, is_active, created_at, updated_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        const mapped = (bins ?? []).map(bin => ({
            id: bin.id,
            apiKey: bin.api_key,
            name: bin.name,
            address: bin.address,
            isActive: bin.is_active,
            createdAt: bin.created_at,
            updatedAt: bin.updated_at,
        }));

        return NextResponse.json({ success: true, data: mapped });
    } catch (error) {
        console.error('Error fetching API Keys:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch API Keys' },
            { status: 500 }
        );
    }
}
