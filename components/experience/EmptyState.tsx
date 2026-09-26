import Image from "next/image";
import Link from "next/link";

export function EmptyState({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return <div className="ex-empty">
    <Image src="/brand/mascot-112.png" width={88} height={88} alt="" />
    <h2>{title}</h2><p>{body}</p>
    {href && cta && <Link className="ex-button" href={href}>{cta} <span aria-hidden="true">↗</span></Link>}
  </div>;
}
