<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { CreditCard, LayoutDashboard, LogOut, Network, ReceiptText, Router, Settings, ShieldCheck, Users, WalletCards } from 'lucide-vue-next';
import { api } from './api';

type SessionUser = { role: string; username: string };
type Branding = { brandName: string; logoDataUrl: string };

const fallbackBrandName = '十夜管理后台';
const nav = [
  { to: '/', label: '概览', icon: LayoutDashboard },
  { to: '/customers', label: '用户', icon: Users },
  { to: '/xui-servers', label: '3x-ui 服务器', icon: Network },
  { to: '/nodes', label: '服务节点', icon: Router },
  { to: '/socks-nodes', label: 'Socks 节点', icon: ShieldCheck },
  { to: '/finance', label: '财务', icon: WalletCards },
  { to: '/cards', label: '卡密', icon: CreditCard },
  { to: '/payments', label: '支付', icon: ReceiptText },
  { to: '/settings', label: '设置', icon: Settings }
];

const checking = ref(true);
const loggingIn = ref(false);
const loginError = ref('');
const user = ref<SessionUser | null>(null);
const branding = reactive<Branding>({ brandName: fallbackBrandName, logoDataUrl: '' });
const loginForm = reactive({ username: '', password: '' });

async function loadBranding() {
  try {
    const payload = await api<{ settings: Branding }>('/api/public/branding');
    branding.brandName = payload.settings.brandName || fallbackBrandName;
    branding.logoDataUrl = payload.settings.logoDataUrl || '';
  } catch {
    branding.brandName = fallbackBrandName;
    branding.logoDataUrl = '';
  } finally {
    applyBrowserBranding(branding);
  }
}

async function loadMe() {
  checking.value = true;
  try {
    const session = await api<SessionUser>('/api/auth/me?entry=admin');
    user.value = session.role === 'admin' ? session : null;
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
    const session = await api<SessionUser>('/api/login', { method: 'POST', body: { ...loginForm, entry: 'admin' } });
    if (session.role !== 'admin') {
      await api('/api/logout', { method: 'POST', body: { entry: 'admin' } }).catch(() => undefined);
      throw new Error('当前账号不是管理员');
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
  await api('/api/logout', { method: 'POST', body: { entry: 'admin' } }).catch(() => undefined);
  user.value = null;
}

function applyBrowserBranding(settings: Branding) {
  document.title = settings.brandName || fallbackBrandName;
  const icon = ensureFaviconElement();
  if (settings.logoDataUrl) icon.href = settings.logoDataUrl;
}

function ensureFaviconElement() {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
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
      <p>管理员登录</p>
      <el-alert v-if="loginError" :title="loginError" type="error" show-icon :closable="false" />
      <el-input v-model="loginForm.username" placeholder="账号" autocomplete="username" />
      <el-input v-model="loginForm.password" type="password" placeholder="密码" autocomplete="current-password" show-password />
      <el-button type="primary" native-type="submit" :loading="loggingIn" :disabled="!loginForm.username || !loginForm.password">登录</el-button>
    </form>
  </div>

  <el-container v-else class="shell">
    <el-aside width="220px" class="sidebar">
      <div class="brand">
        <img v-if="branding.logoDataUrl" :src="branding.logoDataUrl" alt="Logo" />
        <span v-else class="brand-mark">{{ branding.brandName.slice(0, 1) }}</span>
        <strong>{{ branding.brandName }}</strong>
      </div>
      <router-link v-for="item in nav" :key="item.to" :to="item.to" class="nav-item">
        <component :is="item.icon" :size="18" />
        <span>{{ item.label }}</span>
      </router-link>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <span>{{ user.username }}</span>
        <el-button text @click="logout"><LogOut :size="16" />退出</el-button>
      </el-header>
      <el-main>
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>
