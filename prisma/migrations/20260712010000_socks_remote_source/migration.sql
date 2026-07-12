ALTER TABLE `socks_nodes`
  ADD COLUMN `sourceServerId` VARCHAR(191) NULL,
  ADD COLUMN `remoteOutboundTag` VARCHAR(120) NULL;

CREATE INDEX `socks_nodes_sourceServerId_idx` ON `socks_nodes`(`sourceServerId`);
CREATE INDEX `socks_nodes_remoteOutboundTag_idx` ON `socks_nodes`(`remoteOutboundTag`);

ALTER TABLE `socks_nodes`
  ADD CONSTRAINT `socks_nodes_sourceServerId_fkey`
  FOREIGN KEY (`sourceServerId`) REFERENCES `xui_servers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
