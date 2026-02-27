import React from 'react';

// This component is designed to be printed.
// It's a class component because the react-to-print library works best with class component refs.
interface PrintableOrderProps {
  formData: {
    customer_id?: string;
    order_number?: string;
    order_date?: string;
    arrival_time?: string;
    service_type?: string;
    adults?: number;
    kids?: number;
    order_data?: Record<string, { quantity?: number }>;
  };
  customers: Array<{ id?: string; name?: string }>;
}

class PrintableOrder extends React.Component<PrintableOrderProps> {
  render() {
    const { formData, customers } = this.props;
    const customerName = customers.find((customer) => String(customer.id) === String(formData.customer_id))?.name || 'N/A';
    const orderedItems = Object.entries(formData.order_data || {}).filter(([, value]) => (value.quantity || 0) > 0);

    return (
      <div className="p-8 font-sans text-black">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Order Receipt</h1>
          <p className="text-sm">Restaurant Management System</p>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
            <div>
                <h2 className="font-bold mb-1">Customer Details</h2>
                <p>{customerName}</p>
            </div>
            <div className="text-right">
                <h2 className="font-bold mb-1">Order Information</h2>
                <p><strong>Order #:</strong> {formData.order_number}</p>
                <p><strong>Date:</strong> {formData.order_date} at {formData.arrival_time}</p>
                <p><strong>Service:</strong> {formData.service_type}</p>
            </div>
        </div>

        <h2 className="font-bold text-lg mb-2 border-b pb-1">Order Summary</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {orderedItems.map(([name, data]) => (
              <tr key={name} className="border-b border-gray-200">
                <td className="py-2">{name}</td>
                <td className="py-2 text-right">{data.quantity || 0}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-right mt-4">
            <p><strong>Total Pax:</strong> {formData.adults} Adults, {formData.kids} Kids</p>
        </div>

        <div className="text-center text-xs text-gray-500 mt-12">
            <p>Thank you for your order!</p>
        </div>
      </div>
    );
  }
}

export default PrintableOrder;
