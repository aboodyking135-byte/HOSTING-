const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
    // التحقق من توكن الأدمن
    const authHeader = event.headers.authorization;
    if (!authHeader) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ success: false, message: 'Unauthorized' })
      };
    }

    const { 
      username, 
      password, 
      plan, 
      expiryDays, 
      maxContainers, 
      maxStorage, 
      maxBandwidth,
      status 
    } = JSON.parse(event.body);

    const usersPath = path.join(process.cwd(), 'users.json');
    const containersPath = path.join(process.cwd(), 'containers.json');

    let users = [];
    let containers = [];

    if (fs.existsSync(usersPath)) {
      users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    }

    if (fs.existsSync(containersPath)) {
      containers = JSON.parse(fs.readFileSync(containersPath, 'utf8'));
    }

    // التحقق من عدم تكرار اسم المستخدم
    if (users.some(u => u.username === username)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ success: false, message: 'اسم المستخدم موجود بالفعل' })
      };
    }

    // حساب تاريخ انتهاء الصلاحية
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    // إنشاء معرف جديد
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    
    // إنشاء معرف الحاوية
    const containerId = `container-${newId}-${crypto.randomBytes(4).toString('hex')}`;

    // إنشاء المستخدم الجديد
    const newUser = {
      id: newId,
      username,
      password,
      isAdmin: false,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      device: null,
      containerId,
      plan: plan || 'basic',
      expiryDate: expiryDate.toISOString(),
      maxContainers: maxContainers || 1,
      maxStorage: maxStorage || '20GB',
      maxBandwidth: maxBandwidth || '1TB',
      status: status || 'active'
    };

    users.push(newUser);
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    // إنشاء حاوية للمستخدم الجديد
    const newContainer = {
      id: containerId,
      userId: newId,
      name: `${username}-container`,
      status: 'stopped',
      ip: `10.0.0.${100 + newId}`,
      cpu: '0%',
      memory: '0MB / 2GB',
      disk: '0GB / 20GB',
      uptime: '0 days',
      createdAt: new Date().toISOString(),
      lastStarted: null,
      specs: {
        cpu: '2 cores',
        ram: '2GB',
        disk: '20GB',
        bandwidth: '1TB'
      }
    };

    containers.push(newContainer);
    fs.writeFileSync(containersPath, JSON.stringify(containers, null, 2));

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        success: true,
        message: '✅ تم إنشاء المستخدم بنجاح',
        user: {
          id: newUser.id,
          username: newUser.username,
          plan: newUser.plan,
          expiryDate: newUser.expiryDate,
          containerId: newUser.containerId
        }
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        message: 'خطأ في الخادم',
        error: error.message 
      })
    };
  }
};
