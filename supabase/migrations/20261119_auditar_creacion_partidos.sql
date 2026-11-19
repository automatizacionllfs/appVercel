create trigger aud_partidos_insert after insert on partidos
  for each row execute function auditar();
