<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Edit3, Plus, RefreshCw, Search, Trash2 } from 'lucide-vue-next';
import { api } from '../api';

type SocksNode = {
  id: string;
  name: string;
  host: string;
  port: number;
  username?: string | null;
  enabled: boolean;
  remark?: string | null;
  hasPassword?: boolean;
  sourceServerId?: string | null;
  remoteOutboundTag?: string | null;
};
type ServiceNode = { id: string; config?: { socksRelayEnabled?: boolean; socksNodeId?: string | null } | null };
type XuiServer = { id: string; name: string; baseUrl: string; enabled: boolean };
type SocksSyncResult = { remoteSocksFound: number; remoteSocksImported: number };

const nodes = ref<SocksNode[]>([]);
const serviceNodes = ref<ServiceNode[]>([]);
const servers = ref<XuiServer[]>([]);
const loading = ref(false);
const saving = ref(false);
const syncingRemote = ref(false);
const togglingIds = ref<Set<string>>(new Set());
const error = ref('');
const searchQuery = ref('');
const syncServerId = ref('');
const editingId = ref('');
const dialogVisible = ref(false);
const form = reactive({ name: '', host: '', port: 1080, username: '', password: '', enabled: true, remark: '' });

const enabledNodeCount = computed(() => nodes.value.filter((node) => node.enabled).length);
const authedNodeCount = computed(() => nodes.value.filter((node) => node.username || node.hasPassword).length);
const importedNodeCount = computed(() => nodes.value.filter((node) => node.sourceServerId || node.remoteOutboundTag).length);
const usedNodeCount = computed(() => nodes.value.filter((node) => usageCount(node.id) > 0).length);
const enabledServers = computed(() => servers.value.filter((server) => server.enabled));
const filteredNodes = computed(() => {
  const keyword = searchQuery.value.trim().toLowerCase();
  if (!keyword) return nodes.value;
  return nodes.value.filter((node) => socksSearchText(node).includes(keyword));
});

async function loadNodes() {
  loading.value = true;
  error.value = '';
  try {
    const [socksResult, serviceResult, serverResult] = await Promise.all([
      api<SocksNode[]>('/api/admin/socks-nodes'),
      api<ServiceNode[]>('/api/admin/service-nodes'),
      api<XuiServer[]>('/api/admin/xui-servers')
    ]);
    nodes.value = socksResult;
    serviceNodes.value = serviceResult;
    servers.value = serverResult;
    const firstEnabledServer = enabledServers.value[0];
    if (!syncServerId.value && firstEnabledServer) syncServerId.value = firstEnabledServer.id;
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载出站节点失败';
  } finally {
    loading.value = false;
  }
}

async function saveNode() {
  saving.value = true;
  error.value = '';
  try {
    const path = editingId.value ? `/api/admin/socks-nodes/${editingId.value}` : '/api/admin/socks-nodes';
    await api(path, { method: editingId.value ? 'PATCH' : 'POST', body: cleanFormBody() });
    ElMessage.success(editingId.value ? '出站节点已更新' : '出站节点已添加');
    dialogVisible.value = false;
    resetForm();
    await loadNodes();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存出站节点失败';
  } finally {
    saving.value = false;
  }
}

async function syncRemoteSocks() {
  if (!syncServerId.value) {
    ElMessage.warning('请先选择要导入的 3x-ui 服务器');
    return;
  }
  const server = servers.value.find((item) => item.id === syncServerId.value);
  await ElMessageBox.confirm(`确认从“${server?.name || '选中的服务器'}”导入远端 SOCKS 出站节点？此操作只写入本地出站列表，不会新建远端规则。`, '导入远端 SOCKS', { type: 'warning' });
  syncingRemote.value = true;
  error.value = '';
  try {
    const result = await api<SocksSyncResult>(`/api/admin/xui-servers/${syncServerId.value}/sync-socks`, { method: 'POST' });
    ElMessage.success(`远端 SOCKS 导入完成：发现 ${result.remoteSocksFound}，导入/更新 ${result.remoteSocksImported}`);
    await loadNodes();
  } catch (err) {
    error.value = err instanceof Error ? err.message : '导入远端 SOCKS 失败';
    ElMessage.error(error.value);
  } finally {
    syncingRemote.value = false;
  }
}

function openDialog() {
  resetForm();
  dialogVisible.value = true;
}

function editNode(node: SocksNode) {
  editingId.value = node.id;
  Object.assign(form, {
    name: node.name,
    host: node.host,
    port: node.port,
    username: node.username || '',
    password: '',
    enabled: node.enabled,
    remark: node.remark || ''
  });
  dialogVisible.value = true;
}

async function removeNode(node: SocksNode) {
  const remoteHint = node.sourceServerId && node.remoteOutboundTag ? '该节点为导入节点，删除时会同步删除远端对应 SOCKS 出站和引用规则。' : '该节点为手动创建节点，只会删除本地记录。';
  await ElMessageBox.confirm(`确认删除出站节点“${node.name}”？${remoteHint} 正在被路由节点使用时，后端会拒绝删除。`, '删除确认', { type: 'warning' });
  await api(`/api/admin/socks-nodes/${node.id}`, { method: 'DELETE' });
  ElMessage.success('出站节点已删除');
  await loadNodes();
}

async function toggleNodeEnabled(node: SocksNode, enabled: boolean | string | number) {
  const nextEnabled = Boolean(enabled);
  const previous = node.enabled;
  togglingIds.value = new Set(togglingIds.value).add(node.id);
  error.value = '';
  try {
    await api(`/api/admin/socks-nodes/${node.id}`, { method: 'PATCH', body: { enabled: nextEnabled } });
    node.enabled = nextEnabled;
    ElMessage.success(nextEnabled ? '出站节点已启用' : '出站节点已停用');
  } catch (err) {
    node.enabled = previous;
    error.value = err instanceof Error ? err.message : '更新出站节点状态失败';
    ElMessage.error(error.value);
  } finally {
    const next = new Set(togglingIds.value);
    next.delete(node.id);
    togglingIds.value = next;
  }
}

function resetForm() {
  editingId.value = '';
  Object.assign(form, { name: '', host: '', port: 1080, username: '', password: '', enabled: true, remark: '' });
}

function cleanFormBody() {
  return {
    ...form,
    username: form.username.trim() || undefined,
    password: form.password || undefined,
    remark: form.remark.trim() || undefined
  };
}

function usageCount(id: string) {
  return serviceNodes.value.filter((node) => node.config?.socksRelayEnabled && node.config?.socksNodeId === id).length;
}

function serverName(id?: string | null) {
  if (!id) return '';
  return servers.value.find((server) => server.id === id)?.name || id;
}

function socksSearchText(node: SocksNode) {
  return [node.name, node.host, node.port, node.username, node.enabled ? '启用' : '停用', node.remark, node.remoteOutboundTag, serverName(node.sourceServerId), usageCount(node.id)].filter(Boolean).join(' ').toLowerCase();
}

onMounted(loadNodes);
</script>

<template>
  <div class="page-head">
    <div class="page-head-main">
      <h1 class="page-title">出站节点</h1>
      <p>维护 SOCKS 出站中转节点；路由节点启用出站后会引用这里的配置。</p>
    </div>
    <div class="page-actions">
      <el-select v-model="syncServerId" placeholder="选择服务器" style="width: 220px">
        <el-option v-for="server in enabledServers" :key="server.id" :label="server.name" :value="server.id" />
      </el-select>
      <el-button type="primary" :loading="syncingRemote" :disabled="!syncServerId" @click="syncRemoteSocks"><RefreshCw :size="15" />从远端导入</el-button>
      <el-button :loading="loading" @click="loadNodes"><RefreshCw :size="15" />刷新</el-button>
    </div>
  </div>
  <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" class="page-alert" />

  <div class="metric-grid compact-metrics">
    <div class="metric"><span>导入节点</span><strong>{{ importedNodeCount }}</strong><small>来自远端 SOCKS 出站</small></div>
    <div class="metric"><span>出站节点</span><strong>{{ nodes.length }}</strong><small>启用 {{ enabledNodeCount }}</small></div>
    <div class="metric"><span>认证节点</span><strong>{{ authedNodeCount }}</strong><small>配置账号或密码</small></div>
    <div class="metric"><span>被引用</span><strong>{{ usedNodeCount }}</strong><small>正在被路由节点使用</small></div>
    <div class="metric"><span>默认端口</span><strong>1080</strong><small>新增时可调整</small></div>
  </div>

  <div class="panel list-panel">
    <div class="panel-toolbar">
      <strong>出站节点列表</strong>
      <div class="table-toolbar-actions">
        <el-button type="primary" @click="openDialog"><Plus :size="15" />添加出站节点</el-button>
      </div>
    </div>
    <div class="filter-bar">
      <el-input v-model="searchQuery" clearable placeholder="搜索名称、地址、端口、账号、备注" style="max-width: 360px">
        <template #prefix><Search :size="15" /></template>
      </el-input>
      <span class="filter-summary">显示 {{ filteredNodes.length }} / {{ nodes.length }}</span>
    </div>
    <div v-loading="loading" class="entity-card-grid socks-card-grid">
      <article v-for="node in filteredNodes" :key="node.id" class="entity-card socks-card">
        <div class="entity-card-head">
          <div>
            <strong>{{ node.name }}</strong>
            <span>{{ node.host }}:{{ node.port }}</span>
          </div>
          <div class="tag-stack">
            <el-switch v-model="node.enabled" size="small" :loading="togglingIds.has(node.id)" @change="(value: boolean | string | number) => toggleNodeEnabled(node, value)" />
            <el-tag size="small" :type="node.sourceServerId || node.remoteOutboundTag ? 'warning' : 'info'">{{ node.sourceServerId || node.remoteOutboundTag ? '导入' : '创建' }}</el-tag>
            <el-tag v-if="node.username || node.hasPassword" size="small" type="success">账号密码</el-tag>
            <el-tag v-else size="small" type="info">无认证</el-tag>
          </div>
        </div>
        <div class="entity-card-stats">
          <div><span>地址</span><strong>{{ node.host }}</strong></div>
          <div><span>端口</span><strong>{{ node.port }}</strong></div>
          <div><span>引用</span><strong>{{ usageCount(node.id) }} 个</strong></div>
        </div>
        <div class="entity-card-meta">
          <span v-if="node.sourceServerId || node.remoteOutboundTag">来源：{{ serverName(node.sourceServerId) || '远端' }}<template v-if="node.remoteOutboundTag"> / {{ node.remoteOutboundTag }}</template></span>
          <span>{{ node.remark || '暂无备注' }}</span>
        </div>
        <div class="entity-card-actions">
          <el-button size="small" @click="editNode(node)"><Edit3 :size="15" />编辑</el-button>
          <el-button size="small" type="danger" plain @click="removeNode(node)"><Trash2 :size="15" />删除</el-button>
        </div>
      </article>
      <div v-if="!filteredNodes.length && !loading" class="empty-panel entity-empty">暂无出站节点</div>
    </div>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑出站节点' : '添加出站节点'" width="720px" destroy-on-close>
    <el-form :model="form" label-width="92px" class="sectioned-dialog-form">
      <section class="dialog-form-section">
        <div class="dialog-section-head"><strong>出站连接</strong><span>这里保存 SOCKS 地址，路由节点启用出站中转后会写入远端 Xray。</span></div>
        <div class="dialog-form-grid">
          <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
          <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
          <el-form-item label="地址"><el-input v-model="form.host" placeholder="127.0.0.1 或域名" /></el-form-item>
          <el-form-item label="端口"><el-input-number v-model="form.port" :min="1" :max="65535" style="width: 100%" /></el-form-item>
        </div>
      </section>

      <section class="dialog-form-section">
        <div class="dialog-section-head"><strong>认证与备注</strong><span>无账号密码时留空；编辑时密码留空表示不修改。</span></div>
        <div class="dialog-form-grid">
          <el-form-item label="账号"><el-input v-model="form.username" /></el-form-item>
          <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password placeholder="编辑时留空不修改" /></el-form-item>
          <el-form-item label="备注" class="form-item-full"><el-input v-model="form.remark" /></el-form-item>
        </div>
      </section>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!form.name || !form.host || !form.port" @click="saveNode">保存</el-button>
    </template>
  </el-dialog>
</template>
