import { NextRequest, NextResponse } from 'next/server';

// GET - Reverse geocode (coordinates to address)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json(
      { success: false, error: 'Latitude and longitude are required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      {
        headers: {
          'User-Agent': 'MunicipalWasteManagement/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding failed');
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      data: {
        address: data.display_name || 'ไม่ทราบที่อยู่',
        ...data,
      },
    });
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return NextResponse.json({
      success: true,
      data: {
        address: 'ไม่ทราบที่อยู่',
      },
    });
  }
}
