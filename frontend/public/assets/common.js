;(function(){
  var Common = window.Common || {};

  Common.showToast = function(message, type){
    if (typeof window.showToast === 'function') { window.showToast(message, type || 'success'); return; }
    var toast = document.createElement('div');
    toast.className = 'fixed top-20 right-4 px-6 py-3 rounded-lg z-50 transition-all transform translate-x-full opacity-0';
    if ((type||'success') === 'success') toast.classList.add('bg-green-500','text-white');
    else if (type === 'error') toast.classList.add('bg-red-500','text-white');
    else toast.classList.add('bg-blue-500','text-white');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function(){ toast.classList.remove('translate-x-full','opacity-0'); },10);
    setTimeout(function(){ toast.classList.add('translate-x-full','opacity-0'); setTimeout(function(){ document.body.removeChild(toast); },300); },3000);
  };

  Common.setTheme = function(theme){
    if (typeof window.setTheme === 'function') { window.setTheme(theme); return; }
    var html = document.documentElement; var body = document.body;
    if (theme === 'light') {
      html.classList.add('theme-light');
      body.classList.remove('from-slate-800','via-slate-700','to-neutral-800','text-white');
      body.classList.add('animated-gradient','from-white','via-indigo-50','to-sky-100','text-slate-900');
      var icon = document.getElementById('themeIcon'); if (icon) icon.className = 'fa fa-sun-o';
    } else {
      html.classList.remove('theme-light');
      body.classList.remove('animated-gradient','from-white','via-indigo-50','to-sky-100','text-slate-900');
      body.classList.add('from-slate-800','via-slate-700','to-neutral-800','text-white');
      var icon2 = document.getElementById('themeIcon'); if (icon2) icon2.className = 'fa fa-moon-o';
    }
    try { localStorage.setItem('theme', theme); } catch(e){}
    Common.applyChartTheme();
  };

  Common.applyThemeFromStorage = function(){
    var theme = 'dark';
    try { theme = localStorage.getItem('theme') || 'dark'; } catch(e){}
    Common.setTheme(theme);
  };

  Common.applyChartTheme = function(){
    if (!window.Chart || !window.Chart.defaults) return;
    var theme = 'dark';
    try { theme = localStorage.getItem('theme') || 'dark'; } catch(e){}
    var isLight = theme === 'light';
    var textColor = isLight ? '#111827' : '#e5e7eb';
    var gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.15)';
    var borderColor = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = borderColor;
    if (Chart.defaults.plugins && Chart.defaults.plugins.legend && Chart.defaults.plugins.legend.labels) {
      Chart.defaults.plugins.legend.labels.color = textColor;
    }
    if (Chart.defaults.scales) {
      ['linear','category','time','logarithmic'].forEach(function(scale){
        if (Chart.defaults.scales[scale]) {
          var s = Chart.defaults.scales[scale];
          if (s.ticks) s.ticks.color = textColor; else s.ticks = { color: textColor };
          if (s.grid) s.grid.color = gridColor; else s.grid = { color: gridColor };
        }
      });
    }
  };

  Common.validateLogin = function(username, password){
    if (!username || !password) return false;
    if (username.length < 3 || password.length < 3) return false;
    return true;
  };

  Common.validateRegister = function(data){
    var required = ['name','company','department','email','password'];
    for (var i=0;i<required.length;i++){ if(!data[required[i]]) return { ok:false, message:'请填写完整的注册信息' }; }
    if ((data.password||'').length < 6) return { ok:false, message:'密码至少6位' };
    if (data.password !== data.confirmPassword) return { ok:false, message:'两次输入的密码不一致' };
    var email = data.email||'';
    if (email.indexOf('@') < 0) return { ok:false, message:'请输入有效邮箱' };
    return { ok:true };
  };

  Common.validateSignup = function(department, name){
    if (!department || !name) return { ok:false, message:'请填写部门和姓名' };
    if (name.length < 2) return { ok:false, message:'姓名至少2个字符' };
    return { ok:true };
  };

  Common.validateNotice = function(notice){
    if (!notice.title || !notice.type || !notice.department) return { ok:false, message:'请填写通知必填项' };
    if (!notice.summary || !notice.detail) return { ok:false, message:'请填写通知简介与详情' };
    if (!notice.startDate || !notice.endDate) return { ok:false, message:'请填写完整日期' };
    if (new Date(notice.endDate) < new Date(notice.startDate)) return { ok:false, message:'截止日期不得早于开始日期' };
    return { ok:true };
  };

  document.addEventListener('DOMContentLoaded', function(){
    Common.applyThemeFromStorage();
    Common.applyChartTheme();
  });

  // RBAC helpers
  var RBAC = { loaded: false, user: null, orgId: null, roles: [], perms: {}, frozen: false };
  Common.getCurrentUser = async function(){
    try { var gu = await window.Supa.client.auth.getUser(); return (gu && gu.data && gu.data.user) || null; } catch(e){ return null; }
  };
  Common.getUserOrgId = async function(uid){
    try { var pr = await window.Supa.client.from('profiles').select('org_id').eq('id', uid).single(); return (pr && pr.data && pr.data.org_id) || null; } catch(e){ return null; }
  };
  Common.getUserRoles = async function(uid){
    try { var rs = await window.Supa.client.from('user_roles').select('role_code, org_id').eq('user_id', uid); return (rs && rs.data) || []; } catch(e){ return []; }
  };
  Common.getRolePermissions = async function(role){
    try { var ps = await window.Supa.client.from('role_permissions').select('resource, action').eq('role_code', role); return (ps && ps.data) || []; } catch(e){ return []; }
  };
  Common.loadRBACContext = async function(){
    var user = await Common.getCurrentUser(); RBAC.user = user; if (!user){ RBAC.loaded = true; RBAC.roles = []; RBAC.perms = {}; RBAC.frozen = false; return RBAC; }
    var org = await Common.getUserOrgId(user.id); RBAC.orgId = org;
    var roles = await Common.getUserRoles(user.id); RBAC.roles = roles;
    RBAC.frozen = roles.some(function(r){ return r.role_code === 'user_frozen'; });
    // 批量拉取权限
    var codes = roles.map(function(r){ return r.role_code; });
    RBAC.perms = {};
    await Promise.all(codes.map(async function(code){ var list = await Common.getRolePermissions(code); RBAC.perms[code] = list; }));
    RBAC.loaded = true; return RBAC;
  };
  Common.hasPermission = async function(opts){
    var resource = opts.resource; var action = opts.action; var scopeOrg = opts.org_id || null;
    if (!RBAC.loaded) await Common.loadRBACContext();
    var user = RBAC.user; if (!user) return false;
    var roles = RBAC.roles;
    // super_admin 全权
    if (roles.some(function(r){ return r.role_code === 'super_admin'; })) return true;
    // 默认权限映射（减少前期配置成本）
    var defaultMap = {
      org_admin: {
        announcements: ['create','update','delete','read'],
        users: ['manage','read'],
        roles: ['manage','read'],
        activities: ['create','update','delete','read','export'],
        awards: ['create','update','delete','read','export'],
        evaluation: ['create','update','delete','read'],
        alliance: ['create','update','delete','read'],
        stats: ['read','export'],
        sys_config: ['manage','read'],
        avatars: ['manage','read'],
        messages: ['manage','read']
      },
      modern_admin: {
        users: ['manage','read'],
        awards: ['create','update','delete','read','export'],
        quality: ['create','update','delete','read','export'],
        ip: ['create','update','delete','read','export'],
        research: ['create','update','delete','read','export'],
        activities: ['create','update','delete','read','export'],
        evaluation: ['create','update','delete','read'],
        alliance: ['create','update','delete','read'],
        stats: ['read']
      },
      jcz_admin: {
        users: ['manage','read'],
        awards: ['create','update','delete','read','export'],
        quality: ['create','update','delete','read','export'],
        ip: ['create','update','delete','read','export'],
        research: ['create','update','delete','read','export'],
        activities: ['create','update','delete','read','export'],
        evaluation: ['read'],
        alliance: ['read'],
        stats: ['read']
      },
      fk_admin: {
        users: ['manage','read'],
        awards: ['create','update','delete','read','export'],
        quality: ['create','update','delete','read','export'],
        ip: ['create','update','delete','read','export'],
        research: ['create','update','delete','read','export'],
        activities: ['create','update','delete','read','export'],
        evaluation: ['read'],
        alliance: ['read'],
        stats: ['read']
      },
      user: {
        profile: ['read','update'],
        submissions: ['create','read'],
        announcements: ['read'],
        activities: ['read'],
        awards: ['read'],
        export: ['read']
      }
    };
    // org_admin 需资源授权
    var allowed = false;
    for (var i=0;i<roles.length;i++){
      var r = roles[i];
      // 组织范围限制（若提供 scopeOrg，需匹配）
      if (scopeOrg && r.org_id && scopeOrg !== r.org_id) continue;
      var perms = RBAC.perms[r.role_code] || [];
      if (perms.some(function(p){ return p.resource === resource && p.action === action; })) { allowed = true; break; }
      var dm = defaultMap[r.role_code]; if (dm && dm[resource] && dm[resource].indexOf(action)>=0) { allowed = true; break; }
    }
    return allowed;
  };
  // UI 门控：根据 data-permission="resource:action" 控制元素显示/禁用
  Common.guardUI = async function(root){
    var container = root || document;
    var nodes = container.querySelectorAll('[data-permission]');
    await Common.loadRBACContext();
    var user = RBAC.user; if (!user) {
      nodes.forEach(function(el){ el.classList.add('opacity-50','cursor-not-allowed'); el.disabled = true; });
      return;
    }
    var orgId = RBAC.orgId; var frozen = RBAC.frozen;
    if (frozen) { nodes.forEach(function(el){ el.classList.add('opacity-50','cursor-not-allowed'); if ('disabled' in el) el.disabled = true; else el.setAttribute('aria-disabled','true'); }); return; }
    var noRolesFallback = !RBAC.roles || RBAC.roles.length === 0;
    for (var i=0;i<nodes.length;i++){
      var el = nodes[i];
      var pa = el.getAttribute('data-permission').split(':');
      var res = pa[0]; var act = pa[1] || 'read';
      var ok = await Common.hasPermission({ resource: res, action: act, org_id: orgId });
      if (!ok && noRolesFallback) { ok = ['announcements:create','users:manage','roles:manage'].indexOf(res+':'+act) >= 0; }
      if (!ok){ el.classList.add('opacity-50','cursor-not-allowed'); if ('disabled' in el) el.disabled = true; else el.setAttribute('aria-disabled','true'); }
      else { el.classList.remove('opacity-50','cursor-not-allowed'); if ('disabled' in el) el.disabled = false; el.removeAttribute('aria-disabled'); }
    }
  };

  Common.ensureNotFrozen = async function(){
    await Common.loadRBACContext();
    var user = RBAC.user; if (!user){ Common.showToast('请先登录','error'); return false; }
    if (RBAC.frozen){ Common.showToast('账号已冻结，禁止操作','error'); return false; }
    return true;
  };

  // RBAC 初始化：监听会话变化，自动刷新权限与UI
  Common.initRBAC = function(){
    try {
      window.Supa.client.auth.onAuthStateChange(function(){ Common.loadRBACContext().then(function(){ Common.guardUI(document); }); });
    } catch(e){}
  };

  window.Common = Common;
})();