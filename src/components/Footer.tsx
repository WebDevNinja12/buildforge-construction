import Link from "next/link";
import { HardHat, Phone, Mail, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-construction-dark text-slate-300 border-t border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-accent-500 p-1.5 rounded-lg">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">
                Hama <span className="text-accent-500">Construction</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your trusted partner for construction assets, tools, labor, and
              complete project management. Building tomorrow, today.
            </p>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="hover:text-accent-400 transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-accent-400 transition-colors">About Us</Link></li>
              <li><Link href="/projects" className="hover:text-accent-400 transition-colors">Finished Projects</Link></li>
              <li><Link href="/services" className="hover:text-accent-400 transition-colors">Services</Link></li>
              <li><Link href="/contact" className="hover:text-accent-400 transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Our Services</h3>
            <ul className="space-y-2 text-sm">
              <li><Link href="/services#assets" className="hover:text-accent-400 transition-colors">Buy & Reserve Assets</Link></li>
              <li><Link href="/services#land" className="hover:text-accent-400 transition-colors">Land Payments</Link></li>
              <li><Link href="/services#tools" className="hover:text-accent-400 transition-colors">Tool Hiring</Link></li>
              <li><Link href="/services#workers" className="hover:text-accent-400 transition-colors">Construction Hiring</Link></li>
              <li><Link href="/services#projects" className="hover:text-accent-400 transition-colors">Project Management</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-white font-semibold mb-4">Contact Us</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-accent-500 mt-0.5 shrink-0" />
                <span>123 Construction Ave, Build City, BC 10001</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-accent-500 shrink-0" />
                <a href="tel:+1234567890" className="hover:text-accent-400">+1 (234) 567-890</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-accent-500 shrink-0" />
                <a href="mailto:info@hamaconstruction.com" className="hover:text-accent-400">info@hamaconstruction.com</a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-500">
          <p>&copy; {new Date().getFullYear()} Hama Construction. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-slate-300">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-300">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
