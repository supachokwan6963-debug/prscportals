// scripts/create-admin.js
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY 
);

async function setupAdmin() {
  console.log("⏳ กำลังสร้างบัญชีแอดมิน...");

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: 'prsc@piriyalai.ac.th',
    password: 'securePassword123!', // เปลี่ยนรหัสผ่านตรงนี้ได้ตามต้องการครับ
    email_confirm: true
  });

  if (authError) {
    console.error("❌ สร้าง Auth ไม่สำเร็จ:", authError.message);
    return;
  }

  const adminId = authData.user.id;
  console.log("✅ สร้าง Auth สำเร็จ! ได้รับ UUID:", adminId);

  const { error: dbError } = await supabaseAdmin.from('admins').insert([{
    id: adminId,
    email: 'prsc@piriyalai.ac.th',
    display_name: 'สภานักเรียนส่วนกลาง',
    role: 'president',
    scope_grade: null,
    scope_room: null
  }]);

  if (dbError) {
    console.error("❌ บันทึกลงตาราง admins ไม่สำเร็จ:", dbError.message);
  } else {
    console.log("🎉 เตรียมบัญชีแอดมินระบบหลังบ้านเสร็จสมบูรณ์ พร้อมล็อกอิน!");
  }
}

setupAdmin();
