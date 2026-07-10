<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { CircleUserRound, Home, LogOut, Network, ReceiptText } from 'lucide-vue-next';
import { api } from './api';

type SessionUser = { role: string; username: string };
type Branding = { brandName: string; logoDataUrl: string };

const nav = [
  { to: '/', label: '首页', icon: Home },
  { to: '/nodes', label: '节点', icon: Network },
  { to: '/finance', label: '财务', icon: ReceiptText },
  { to: '/profile', label: '资料', icon: CircleUserRound }
];

const checking = ref(true);
const loggingIn = ref(false);
const loginError = ref('');
const user = ref<SessionUser | null>(null);
const branding = reactive<Branding>({ brandName: '十夜用户中心', logoDataUrl: '' });
const loginForm = reactive({ username: '', password: '' });

async function loadBranding() {
  try {
    const payload = await api<{ settings: Branding }>('/api/public/branding');
    branding.brandName = payload.settings.brandName || '十夜用户中心';
    branding.logoDataUrl = payload.settings.logoDataUrl || '';
  } catch {
    branding.brandName = '十夜用户中心';
    branding.logoDataUrl = '';
  }
}

async function loadMe() {
  checking.value = true;
  try {
    const session = await api<SessionUser>('/api/auth/me?entry=user');
    user.value = session.role === 'user' ? session : null;
  } catch {
    user.value = null;
  } finally {
    checking.value = false;
  }
}

async function login() {
  loggingIn.value = true;
  loginError.value = '';
  try {
    const session = await api<SessionUser>('/api/login', { method: 'POST', body: { ...loginForm, entry: 'user' } });
    if (session.role !== 'user') {
      await api('/api/logout', { method: 'POST', body: { entry: 'user' } }).catch(() => undefined);
      throw new Error('当前账号不是用户账号');
    }
    user.value = session;
    Object.assign(loginForm, { username: '', password: '' });
  } catch (err) {
    loginError.value = err instanceof Error ? err.message : '登录失败';
  } finally {
    loggingIn.value = false;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST', body: { entry: 'user' } }).catch(() => undefined);
  user.value = null;
}

onMounted(async () => {
  await loadBranding();
  await loadMe();
});
</script>

<template>
  <div v-if="checking" class="boot-screen">正在检查登录状态</div>

  <div v-else-if="!user" class="login-screen">
    <form class="login-panel" @submit.prevent="login">
      <div class="login-brand">
        <img v-if="branding.logoDataUrl" :src="branding.logoDataUrl" alt="Logo" />
        <span v-else>{{ branding.brandName.slice(0, 1) }}</span>
      </div>
      <h1>{{ branding.brandName }}</h1>
      <p>用户登录</p>
      <div v-if="loginError" class="error-text">{{ loginError }}</div>
      <input v-model="loginForm.username" placeholder="账号" autocomplete="username" />
      <input v-model="loginForm.password" type="password" placeholder="密码" autocomplete="current-password" />
      <button :disabled="loggingIn || !loginForm.username || !loginForm.password">{{ loggingIn ? '登录中' : '登录' }}</button>
    </form>
  </div>

  <div v-else class="app-shell">
    <header class="header">
      <div class="header-brand">
        <img v-if="branding.logoDataUrl" :src="branding.logoDataUrl" alt="Logo" />
        <span v-else class="brand-mark">{{ branding.brandName.slice(0, 1) }}</span>
        <strong>{{ branding.brandName }}</strong>
      </div>
      <nav>
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="nav-link">
          <component :is="item.icon" :size="18" />
          <span>{{ item.label }}</span>
        </router-link>
        <button class="logout-button" @click="logout"><LogOut :size="16" />退出</button>
      </nav>
    </header>
    <main class="main">
      <router-view />
    </main>
  </div>
</template>
