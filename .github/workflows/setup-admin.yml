name: Setup Admin Account

on:
  workflow_dispatch:

jobs:
  create-admin:
    runs-on: ubuntu-latest

    steps:
      - name: ⚙️ Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: 📦 Install Supabase JS
        run: npm install @supabase/supabase-js

      - name: 📝 Create Script Dynamically
        # สร้างไฟล์ create-admin.js กลางอากาศบน Runner
        run: |
          cat << 'EOF' > create-admin.js
          const { createClient } = require('@supabase/supabase-js');
          const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
          
          async function setupAdmin() {
            console.log("⏳ กำลังสร้างบัญชีแอดมิน...");
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
              email: 'prsc@piriyalai.ac.th',
              password: 'securePassword123!', 
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
          EOF

      - name: 🚀 Run Create Admin Script
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node create-admin.js
