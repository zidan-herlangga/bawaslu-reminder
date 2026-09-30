import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] crash:', error, info);
  }

  handleReload = () => {
    window.location.assign('/');
  };

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="rounded-xl border border-bw-red-100 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-bw-red">
          Terjadi kesalahan
        </p>
        <h2 className="mt-1 font-display text-[15px] font-bold text-bw-ink">
          Halaman gagal ditampilkan
        </h2>
        <p className="mt-2 break-words text-xs leading-relaxed text-bw-muted">
          {this.state.error?.message || 'Kesalahan tidak diketahui.'}
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="flex-1 rounded-lg bg-bw-blue px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-bw-blue-hi focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
          >
            Coba lagi
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="rounded-lg border border-bw-line bg-white px-4 py-2.5 text-xs font-semibold text-bw-muted transition-colors hover:border-bw-blue-200 hover:text-bw-blue focus:outline-none focus:ring-2 focus:ring-bw-blue/40"
          >
            Muat ulang
          </button>
        </div>
      </div>
    );
  }
}
