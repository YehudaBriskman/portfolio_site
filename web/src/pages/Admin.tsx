import PostsDesktop from "@/components/admin/posts/PostsDesktop";
import PostsPhone from "@/components/admin/posts/PostsPhone";
import { usePhone } from "@/hooks/usePhone";

/* Below 600px the list is rows, not a table: the phone screen is its own component, so a phone never mounts the desktop one. */
export default function Admin() {
  return usePhone() ? <PostsPhone /> : <PostsDesktop />;
}
