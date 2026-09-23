import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'Clipstudio — tvoje klipy, jeden príbeh',description:'Lokálny editor vertikálnych videí. Nahrajte, zostrihajte a exportujte vlastné videá.',icons:{icon:'/icon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="sk"><body>{children}</body></html>;}
