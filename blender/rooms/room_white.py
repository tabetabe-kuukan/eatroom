"""部屋モジュール：何も食べられていない、ただのホワイトキューブ"""
from room import Room

r = Room("room_white")
r.shell()
r.place_slots()
r.finish()
