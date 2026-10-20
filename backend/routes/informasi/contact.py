# ==========================================
# SECTION: Imports
# ==========================================

from flask import Blueprint, request, jsonify, current_app, copy_current_request_context
from flask_mail import Message, Mail
import threading

from backend.emails.utils import attach_logo, render_email_template

contact_bp = Blueprint('contact', __name__)

# ==========================================
# SECTION: Routes & API Logic
# ==========================================
# ==================== 1. MENANGANI CONTACT ====================

@contact_bp.route('/contact', methods=['POST'])
def contact():
    data = request.form
    name = data.get('name')
    email = data.get('email')
    subject = data.get('subject')
    message = data.get('message')

    if not all([name, email, subject, message]):
        return jsonify({'error': 'All fields are required'}), 400


# ==================== 2. MENGIRIM EMAIL KONTAK ====================

    @copy_current_request_context
    def send_emails():
        mail = Mail(current_app)
        try:
            admin_msg = Message(
                subject=f"Pesan Baru dari Formulir Kontak: {subject}",
                recipients=[current_app.config['CONTACT_NOTIFICATION_EMAIL']],
                html=render_email_template(
                    'contact_admin_notification.html',
                    name=name, email=email, subject=subject, message=message,
                )
            )
            attach_logo(admin_msg)
            mail.send(admin_msg)


            thank_you_msg = Message(
                subject="Terima Kasih Telah Menghubungi StunTrack",
                recipients=[email],
                html=render_email_template(
                    'contact_thank_you.html',
                    name=name, subject=subject, message=message,
                )
            )
            attach_logo(thank_you_msg)
            mail.send(thank_you_msg)
        except Exception as e:
            print(f"Email sending failed: {str(e)}")

    threading.Thread(target=send_emails).start()

    return jsonify({'message': 'Message sent successfully'}), 200
