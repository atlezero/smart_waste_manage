import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, username, password } = body;

        if (!name || !username || !password) {
            return NextResponse.json(
                { success: false, error: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Check if username already exists
        const { data: existingUser } = await supabaseServer
            .from('users')
            .select('id')
            .eq('username', username)
            .single();

        if (existingUser) {
            return NextResponse.json(
                { success: false, error: 'ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว' },
                { status: 400 }
            );
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const { data: newUser, error } = await supabaseServer
            .from('users')
            .insert([
                {
                    name,
                    username,
                    password: hashedPassword,
                    role: 'user', // Default role for new signups
                }
            ])
            .select('*')
            .single();

        if (error) throw error;

        return NextResponse.json({
            success: true,
            data: {
                id: newUser.id,
                username: newUser.username,
                name: newUser.name,
                role: newUser.role,
            }
        });

    } catch (error: any) {
        console.error('Registration error:', error);

        // Return a generic error if it indicates the table doesn't exist
        if (error.code === '42P01') {
            return NextResponse.json(
                { success: false, error: 'ไม่พบตาราง users ในฐานข้อมูล (กรุณาสร้างตาราง users ก่อน)' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { success: false, error: 'เกิดข้อผิดพลาดในการลงทะเบียน' },
            { status: 500 }
        );
    }
}
