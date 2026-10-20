from flask import Blueprint, jsonify
from backend.data.variable_database import KUESIONER_ITEMS, SKALA_PENGISIAN

kuesioner_bp = Blueprint('kuesioner', __name__, url_prefix='/kuesioner')


@kuesioner_bp.route('', methods=['GET'])
def get_kuesioner():
    return jsonify(KUESIONER_ITEMS)


@kuesioner_bp.route('/skala', methods=['GET'])
def get_skala_pengisian():
    return jsonify(SKALA_PENGISIAN)
