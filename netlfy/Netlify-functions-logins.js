const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ success: false, message: 'Method not allowed' })
    };
  }

  try {
    const { username, password, device } = JSON.parse(event.body);
    
    const usersPath = path.join(process.cwd(), 'users.json');
    
    // إنشاء المستخدمين الافتراضيين إذا لم يوجد ملف
    if (!fs.existsSync(usersPath)) {
      const defaultUsers = [
        {
          id: 1,
          username: 'DragonMaster',
          password: 'Dragon@Host2026',
          isAdmin: true,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          device: null,
          containerId: 'admin-container',
          plan: 'enterprise',
          expiryDate: '2030-12-31T23:59:59.999Z', // 4 سنوات
          maxContainers: 10,
          maxStorage: '500GB',
          maxBandwidth: '50TB',
          status: 'active'
        },
        {
          id: 2,
          username: 'ClientVIP',
          password: 'Client@2026',
          isAdmin: false,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          device: null,
          containerId: 'client-container-1',
          plan: 'vip',
          expiryDate: '2026-06-30T23:59:59.999Z', // 3 شهور
          maxContainers: 3,
          maxStorage: '100GB',
          maxBandwidth: '5TB',
          status: 'active'
        },
        {
          id: 3,
          username: 'ClientBasic',
          password: 'Basic@2026',
          isAdmin: false,
          createdAt: new Date().toISOString(),
          lastLogin: null,
          device: null,
          containerId: 'client-container-2',
          plan: 'basic',
          expiryDate: '2026-04-15T23:59:59.999Z', // شهر واحد
          maxContainers: 1,
          maxStorage: '20GB',
          maxBandwidth: '1TB',
          status: 'active'
        }
      ];
      fs.writeFileSync(usersPath, JSON.stringify(defaultUsers, null, 2));
    }

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    const user = users.find(u => u.username === username && u.password === password);

    if (!user) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, message: 'بيانات الدخول غير صحيحة' })
      };
    }

    // التحقق من حالة المستخدم
    if (user.status !== 'active') {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: '❌ حسابك غير نشط. يرجى التواصل مع الدعم الفني.',
          code: 'ACCOUNT_INACTIVE'
        })
      };
    }

    // التحقق من تاريخ انتهاء الصلاحية
    const now = new Date();
    const expiry = new Date(user.expiryDate);
    
    if (expiry < now) {
      // تحديث حالة المستخدم إلى منتهي الصلاحية
      user.status = 'expired';
      fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
      
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ 
          success: false, 
          message: '❌ انتهت صلاحية حسابك. يرجى تجديد الاشتراك.',
          code: 'EXPIRED',
          expiryDate: user.expiryDate
        })
      };
    }

    // حساب الوقت المتبقي
    const remainingTime = expiry - now;
    const remainingDays = Math.floor(remainingTime / (1000 * 60 * 60 * 24));
    const remainingHours = Math.floor((remainingTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // تحديث آخر تسجيل دخول
    user.lastLogin = new Date().toISOString();
    user.device = device;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // إنشاء توكن
    const token = crypto.createHash('sha256')
      .update(`${user.id}-${Date.now()}-${crypto.randomBytes(16).toString('hex')}`)
      .digest('hex');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          isAdmin: user.isAdmin,
          plan: user.plan,
          expiryDate: user.expiryDate,
          remainingDays,
          remainingHours,
          maxContainers: user.maxContainers,
          maxStorage: user.maxStorage,
          maxBandwidth: user.maxBandwidth,
          containerId: user.containerId
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم. يرجى المحاولة لاحقاً.',
        error: error.message 
      })
    };
  }
};
