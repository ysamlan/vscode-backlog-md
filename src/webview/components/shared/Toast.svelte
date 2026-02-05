<script lang="ts">
  interface Props {
    message: string;
    onDismiss?: () => void;
    duration?: number;
  }

  let { message, onDismiss, duration = 3000 }: Props = $props();

  $effect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  });
</script>

<div class="toast" role="alert">
  {message}
</div>
