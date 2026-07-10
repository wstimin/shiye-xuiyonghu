<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { RefreshCw, Wifi } from 'lucide-vue-next';
import { api } from '../api';

type XuiServer = {
  id: string;
  name: string;
  baseUrl: string;
  basePath?: string | null;
  username?: string | null;
  enabled: boolean;
  remark?: string | null;
  hasPassword?: boolean;
  hasToken?: boolean;
};

type SyncResult = { total: number; success: number; failed: number };

const servers = ref<XuiServer[]>([]);
const loading = ref(false);
const saving = ref(false);
const testingForm = ref(false);
const testingIds = ref<Set<string>>(new Set());
const syncingIds = ref<Set<string>>(new Set());
const error = ref('');
const editingId = ref('');
const dialogVisible = ref(false);
const form = reactive({ name: '', baseUrl: '', basePath: '', username: '', password: '', token: '', enabled: true, remark: '' });

async function loadServers() {
  loading.value = true;
  error.value = '';
  try {
    servers.value = await api<XuiServer[]>('/api/admin/xui-servers');
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载 3x-ui 服务器失败';
  } finally {
    loading.value = false;
  }
}

async function saveServer() {
  saving.value = true;
  error.value = '';
  try {
    const path = editingId.value ? `/api/admin/xui-servers/${editingId.value}` : '/api/admin/xui-servers';
    await api(path, { method: editingId.value ? 'PATCH' : 'POST', body: cleanFormBody() });
    ElMessage.success(editingId.value ? '服务器已更新' : '服务器已添加');
    dialogVisible.value = false;
    resetForm();
    await loadServers();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存服务器失败';
  } finally {
    saving.value = false;
  }
}

async function testForm() {
  testingForm.value = true;
  error.value = '';
  try {
    const result = await api<{ connected: boolean; inbounds: unknown }>('/api/admin/xui/test', { method: 'POST', body: cleanFormBody() });
    const inbounds = Array.isArray(result.inbounds) ? result.inbounds.length : '-';
    ElMessage.success(`连接成功，入站数量：${inbounds}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '测试连接失败';
  } finally {
    testingForm.value = false;
  }
}

async function testSaved(server: XuiServer) {
  testingIds.value = new Set(testingIds.value).add(server.id);
  error.value = '';
  try {
    const result = await api<{ inboundCount: number }>(`/api/admin/xui-servers/${server.id}/test`, { method: 'POST' });
    ElMessage.success(`${server.name} 连接成功，入站数量：${result.inboundCount}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '测试已保存服务器失败';
  } finally {
    const next = new Set(testingIds.value);
    next.delete(server.id);
    testingIds.value = next;
  }
}

async function syncServer(server: XuiServer) {
  await ElMessageBox.confirm(`确认把服务器“${server.name}”下全部已绑定用户同步到远端 3x-ui？`, '同步确认', { type: 'warning' });
  syncingIds.value = new Set(syncingIds.value).add(server.id);
  error.value = '';
  try {
    const result = await api<SyncResult>(`/api/admin/xui-servers/${server.id}/sync`, { method: 'POST' });
    ElMessage.success(`服务器同步完成：成功 ${result.success}，失败 ${result.failed}，总数 ${result.total}`);
  } catch (err) {
    error.value = err instanceof Error ? err.message : '同步服务器失败';
  } finally {
    const next = new Set(syncingIds.value);
    next.delete(server.id);
    syncingIds.value = next;
  }
}

function openDialog() {
  resetForm();
  dialogVisible.value = true;
}

function editServer(server: XuiServer) {
  editingId.value = server.id;
  Object.assign(form, {
    name: server.name,
    baseUrl: server.baseUrl,
    basePath: server.basePath || '',
    username: server.username || '',
    password: '',
    token: '',
    enabled: server.enabled,
    remark: server.remark || ''
  });
  dialogVisible.value = true;
}

async function removeServer(server: XuiServer) {
  await ElMessageBox.confirm(`确认删除服务器“${server.name}”？有关联服务节点时请先处理节点。`, '删除确认', { type: 'warning' });
  await api(`/api/admin/xui-servers/${server.id}`, { method: 'DELETE' });
  ElMessage.success('服务器已删除');
  await loadServers();
}

function resetForm() {
  editingId.value = '';
  Object.assign(form, { name: '', baseUrl: '', basePath: '', username: '', password: '', token: '', enabled: true, remark: '' });
}

function cleanFormBody() {
  return {
    ...form,
    basePath: form.basePath.trim() || undefined,
    username: form.username.trim() || undefined,
    password: form.password || undefined,
    token: form.token || undefined,
    remark: form.remark.trim() || undefined
  };
}

onMounted(loadServers);
</script>

<template>
  <h1 class="page-title">3x-ui 服务器</h1>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="page-alert" />

  <div class="panel list-panel">
    <div class="panel-toolbar">
      <strong>服务器列表</strong>
      <div class="table-toolbar-actions">
        <el-button type="primary" @click="openDialog">添加服务器</el-button>
        <el-button :loading="loading" @click="loadServers">刷新</el-button>
      </div>
    </div>
    <el-table :data="servers" v-loading="loading" style="width: 100%">
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="baseUrl" label="面板地址" min-width="220" />
      <el-table-column prop="basePath" label="路径" width="120" />
      <el-table-column label="凭据" width="150">
        <template #default="{ row }: { row: XuiServer }">
          <el-tag v-if="row.hasToken" size="small" type="success">Token</el-tag>
          <el-tag v-else-if="row.hasPassword" size="small">账号密码</el-tag>
          <el-tag v-else size="small" type="warning">未配置</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }: { row: XuiServer }"><el-tag :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="340" fixed="right">
        <template #default="{ row }: { row: XuiServer }">
          <el-button size="small" :loading="testingIds.has(row.id)" @click="testSaved(row)"><Wifi :size="15" />测试</el-button>
          <el-button size="small" :loading="syncingIds.has(row.id)" :disabled="!row.enabled" @click="syncServer(row)"><RefreshCw :size="15" />同步用户</el-button>
          <el-button size="small" @click="editServer(row)">编辑</el-button>
          <el-button size="small" type="danger" @click="removeServer(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑 3x-ui 服务器' : '添加 3x-ui 服务器'" width="760px" destroy-on-close>
    <el-form :model="form" label-width="96px" class="dialog-form-grid">
      <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="面板地址"><el-input v-model="form.baseUrl" placeholder="https://xui.example.com" /></el-form-item>
      <el-form-item label="面板路径"><el-input v-model="form.basePath" placeholder="根路径留空" /></el-form-item>
      <el-form-item label="账号"><el-input v-model="form.username" /></el-form-item>
      <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password placeholder="编辑时留空不修改" /></el-form-item>
      <el-form-item label="API Token"><el-input v-model="form.token" type="password" show-password placeholder="编辑时留空不修改" /></el-form-item>
      <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button :loading="testingForm" :disabled="!form.baseUrl" @click="testForm"><Wifi :size="15" />测试连接</el-button>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!form.name || !form.baseUrl" @click="saveServer">保存</el-button>
    </template>
  </el-dialog>
</template>
