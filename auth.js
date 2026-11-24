(async function () {
  "use strict";

  const SESSION_KEY = "almumez-customer-session";
  const RESET_KEY = "almumez-password-reset";
  // Customer authentication never fabricates an identity when disconnected.
  const unavailable = async () => { throw new Error('BACKEND_NOT_CONFIGURED'); };
  const AuthAPI = {login:unavailable,register:unavailable,googleSignIn:unavailable,requestPasswordReset:unavailable,resetPassword:unavailable};

  const cloud = window.StoreSupabase;
  if (cloud?.enabled) {
    const auth = cloud.client.auth;
    const profile = user => ({id:user.id,name:user.user_metadata?.name||user.email.split('@')[0],email:user.email});
    Object.assign(AuthAPI, {
      async login({email,password}) {const {data,error}=await auth.signInWithPassword({email,password});if(error)throw error;return {user:profile(data.user)}},
      async register({name,email,password}) {const {data,error}=await auth.signUp({email,password,options:{data:{name},emailRedirectTo:new URL('auth.html',location.href).href}});if(error)throw error;return {user:data.session?profile(data.user):null,confirmationRequired:!data.session}},
      async googleSignIn() {const {error}=await auth.signInWithOAuth({provider:'google',options:{redirectTo:new URL('auth.html',location.href).href}});if(error)throw error;return {redirecting:true}},
      async requestPasswordReset({email}) {const {error}=await auth.resetPasswordForEmail(email,{redirectTo:new URL('reset-password.html',location.href).href});if(error)throw error;return {ok:true}},
      async resetPassword({password}) {if(!cloud.isRecovery())throw Error('INVALID_TOKEN');const {error}=await auth.updateUser({password});if(error)throw error;await auth.signOut();return {ok:true}},
      async logout() {const {error}=await auth.signOut();if(error)throw error;localStorage.removeItem(SESSION_KEY)}
    });
    cloud.subscribe(({event,session})=>{if(session?.user)setSession(profile(session.user));else if(event==='SIGNED_OUT')localStorage.removeItem(SESSION_KEY)});
  }
  const page = document.body.dataset.authPage;
  const message = document.querySelector("[data-auth-message]");
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function readResetRequest() {
    try { return JSON.parse(localStorage.getItem(RESET_KEY) || "null"); }
    catch { return null; }
  }

  function setSession(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user, createdAt: Date.now() }));
  }

  function showMessage(text, type = "success") {
    if (!message) return;
    message.hidden = false;
    message.className = `auth-message is-${type}`;
    message.textContent = text;
  }

  function clearMessage() {
    if (!message) return;
    message.hidden = true;
    message.textContent = "";
  }

  function setError(input, text = "") {
    const error = document.querySelector(`[data-error-for="${input.id}"]`);
    input.closest(".auth-input")?.classList.toggle("has-error", Boolean(text));
    if (error) error.textContent = text;
    return !text;
  }

  function validateEmail(input) {
    if (!input.value.trim()) return setError(input, "البريد الإلكتروني مطلوب.");
    if (!emailPattern.test(input.value.trim())) return setError(input, "اكتب بريدًا إلكترونيًا صالحًا.");
    return setError(input);
  }

  function validatePassword(input) {
    if (!input.value) return setError(input, "كلمة المرور مطلوبة.");
    if (input.value.length < 8) return setError(input, "كلمة المرور لازم تكون 8 حروف على الأقل.");
    return setError(input);
  }

  function setLoading(form, loading) {
    const button = form.querySelector('[type="submit"]');
    form.setAttribute("aria-busy", String(loading));
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
  }

  document.querySelectorAll(".auth-password-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.parentElement.querySelector("input");
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.setAttribute("aria-label", visible ? "إظهار كلمة المرور" : "إخفاء كلمة المرور");
      button.querySelector(".material-symbols-outlined").textContent = visible ? "visibility" : "visibility_off";
    });
  });

  if (page === "auth") {
    // Opening the login page is intentional, even when a saved session exists.
    const tabs = document.querySelectorAll("[data-auth-tab]");
    const forms = document.querySelectorAll("[data-auth-form]");
    tabs.forEach((tab) => tab.addEventListener("click", () => {
      clearMessage();
      tabs.forEach((item) => {
        const active = item === tab;
        item.classList.toggle("is-active", active);
        item.setAttribute("aria-selected", String(active));
      });
      forms.forEach((form) => { form.hidden = form.dataset.authForm !== tab.dataset.authTab; });
      document.querySelector(`[data-auth-form="${tab.dataset.authTab}"] input`)?.focus();
    }));

    document.querySelector('[data-auth-form="login"]').addEventListener("submit", async (event) => {
      event.preventDefault(); clearMessage();
      const form = event.currentTarget, email = form.elements.email, password = form.elements.password;
      if (![validateEmail(email), validatePassword(password)].every(Boolean)) return;
      setLoading(form, true);
      try {
        const result = await AuthAPI.login({ email: email.value.trim(), password: password.value });
        setSession(result.user); showMessage("تم تسجيل الدخول بنجاح. جاري تحويلك للمتجر…");
        setTimeout(() => location.replace(cloud?.enabled?"account.html":"index.html"), 700);
      } catch { showMessage("تعذر تسجيل الدخول. حاول مرة أخرى.", "error"); setLoading(form, false); }
    });

    document.querySelector('[data-auth-form="register"]').addEventListener("submit", async (event) => {
      event.preventDefault(); clearMessage();
      const form = event.currentTarget, name = form.elements.name, email = form.elements.email,
        password = form.elements.password, confirm = form.elements.confirmPassword;
      const validName = setError(name, name.value.trim() ? "" : "الاسم مطلوب.");
      const validConfirm = setError(confirm, password.value === confirm.value ? "" : "كلمتا المرور غير متطابقتين.");
      if (![validName, validateEmail(email), validatePassword(password), validConfirm].every(Boolean)) return;
      setLoading(form, true);
      try {
        const result = await AuthAPI.register({ name: name.value.trim(), email: email.value.trim(), password: password.value });
        if(result.confirmationRequired){showMessage(document.documentElement.lang==='ar'?'راجع بريدك الإلكتروني لتأكيد الحساب قبل تسجيل الدخول.':'Check your email to confirm your account before signing in.');setLoading(form,false);return}
        setSession(result.user); showMessage("تم إنشاء حسابك بنجاح. جاري تحويلك للمتجر…");
        setTimeout(() => location.replace(cloud?.enabled?"account.html":"index.html"), 700);
      } catch { showMessage("تعذر إنشاء الحساب. حاول مرة أخرى.", "error"); setLoading(form, false); }
    });

    document.querySelector("[data-google-auth]").addEventListener("click", async (event) => {
      const button = event.currentTarget; clearMessage(); button.disabled = true; button.classList.add("is-loading");
      try { const result = await AuthAPI.googleSignIn(); if(result.redirecting)return;setSession(result.user); showMessage("تم تسجيل الدخول بواسطة جوجل."); setTimeout(() => location.replace(cloud?.enabled?"account.html":"index.html"), 700); }
      catch { showMessage("تعذر تسجيل الدخول بواسطة جوجل.", "error"); button.disabled = false; button.classList.remove("is-loading"); }
    });
  }

  if (page === "forgot-password") {
    const form = document.querySelector('[data-auth-form="forgot"]'), resend = document.querySelector("[data-resend]"), count = document.querySelector("[data-resend-count]");
    let lastEmail = "", timer;
    function startCooldown() {
      let remaining = 60; resend.hidden = false; resend.disabled = true;
      count.textContent = `(${remaining})`;
      clearInterval(timer);
      timer = setInterval(() => { remaining -= 1; count.textContent = remaining ? `(${remaining})` : ""; if (!remaining) { clearInterval(timer); resend.disabled = false; } }, 1000);
    }
    async function send(email) {
      setLoading(form, true);
      try { await AuthAPI.requestPasswordReset({ email }); showMessage("لو البريد ده مسجّل عندنا هيوصلك رابط خلال دقايق"); startCooldown(); }
      catch { showMessage(document.documentElement.lang==='ar'?'تعذر إرسال رابط الاستعادة؛ خدمة الحساب غير متاحة.':'The reset link could not be sent; the account service is unavailable.', 'error'); }
      finally { setLoading(form, false); }
    }
    form.addEventListener("submit", async (event) => { event.preventDefault(); clearMessage(); const email = form.elements.email; if (!validateEmail(email)) return; lastEmail = email.value.trim(); await send(lastEmail); });
    resend.addEventListener("click", async () => { if (!lastEmail || resend.disabled) return; resend.disabled = true; await send(lastEmail); });
  }

  if (page === "reset-password") {
    const form = document.querySelector('[data-auth-form="reset"]'), invalid = document.querySelector("[data-invalid-token]"), token = new URLSearchParams(location.search).get("token"), request = readResetRequest();
    if(cloud?.enabled)await cloud.session();
    const validToken = cloud?.enabled?cloud.isRecovery():Boolean(token && request && request.token === token && request.expiresAt >= Date.now());
    form.hidden = !validToken; invalid.hidden = validToken;
    if (validToken) form.addEventListener("submit", async (event) => {
      event.preventDefault(); clearMessage();
      const password = form.elements.password, confirm = form.elements.confirmPassword;
      const validConfirm = setError(confirm, password.value === confirm.value ? "" : "كلمتا المرور غير متطابقتين.");
      if (![validatePassword(password), validConfirm].every(Boolean)) return;
      setLoading(form, true);
      try { await AuthAPI.resetPassword({ token, password: password.value }); showMessage("تم تحديث كلمة المرور بنجاح. سيتم تحويلك لتسجيل الدخول…"); setTimeout(() => location.replace("auth.html"), 1200); }
      catch { form.hidden = true; invalid.hidden = false; showMessage("الرابط غير صالح أو منتهي.", "error"); }
    });
  }

  if(cloud?.enabled&&page==='auth'&&await cloud.session()){const link=document.createElement('a');link.href='account.html';link.textContent=document.documentElement.lang==='ar'?'حسابي وطلباتي':'My account and orders';document.querySelector('.auth-card')?.append(link);}
  window.AlMumezAuthAPI = AuthAPI;
})();
