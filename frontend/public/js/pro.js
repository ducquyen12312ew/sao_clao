async function pay(plan) {
  try {
    const res = await fetch('/pro/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });

    const data = await res.json();

    if (data.success && data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert(data.message || 'Không tạo được phiên thanh toán');
    }
  } catch (err) {
    console.error(err);
    alert('Lỗi kết nối. Vui lòng thử lại.');
  }
}

// Expose global (vì HTML gọi onclick)
window.pay = pay;
